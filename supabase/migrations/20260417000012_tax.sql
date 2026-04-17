-- =============================================================
-- Steuer-Tracking: Umsatzsteuer, Vorsteuer, Rücklagen
-- (DE: Regelbesteuerer — 19% USt Standard, 7% reduziert)
-- =============================================================

create table if not exists tax_settings (
    id int primary key default 1,
    default_vat_rate numeric(4, 2) not null default 19.00,          -- %
    reduced_vat_rate numeric(4, 2) not null default 7.00,
    is_regelbesteuerer boolean not null default true,                -- false = Kleinunternehmer (§19)
    reserve_pct_income_tax numeric(4, 2) not null default 30.00,     -- %
    reserve_pct_gewerbesteuer numeric(4, 2) not null default 15.00,  -- %
    gmbh boolean not null default false,                             -- if true: KSt 15% + Soli + Gewerbesteuer
    updated_at timestamptz not null default now(),
    check (id = 1)
);

insert into tax_settings (id) values (1) on conflict (id) do nothing;

-- =============================================================
-- Extend expense tables with VAT columns so we can reclaim Vorsteuer
-- =============================================================
alter table delivery_costs     add column if not exists net_amount numeric(12, 2);
alter table delivery_costs     add column if not exists vat_amount numeric(12, 2);
alter table delivery_costs     add column if not exists vat_rate   numeric(4, 2);

alter table manual_expenses    add column if not exists net_amount numeric(12, 2);
alter table manual_expenses    add column if not exists vat_amount numeric(12, 2);
alter table manual_expenses    add column if not exists vat_rate   numeric(4, 2);

alter table recruiting_costs   add column if not exists net_amount numeric(12, 2);
alter table recruiting_costs   add column if not exists vat_amount numeric(12, 2);
alter table recruiting_costs   add column if not exists vat_rate   numeric(4, 2);

-- Helper: if only gross is set, derive net + VAT using default rate
create or replace function fill_vat_from_gross() returns trigger as $$
declare
    rate numeric;
begin
    rate := coalesce(new.vat_rate,
                     (select default_vat_rate from tax_settings where id = 1),
                     19);
    if new.net_amount is null and new.vat_amount is null and new.amount is not null then
        new.net_amount := round(new.amount / (1 + rate / 100), 2);
        new.vat_amount := round(new.amount - new.net_amount, 2);
        new.vat_rate   := rate;
    end if;
    return new;
end $$ language plpgsql;

drop trigger if exists trg_delivery_costs_vat  on delivery_costs;
create trigger trg_delivery_costs_vat  before insert or update on delivery_costs
    for each row execute function fill_vat_from_gross();
drop trigger if exists trg_manual_expenses_vat on manual_expenses;
create trigger trg_manual_expenses_vat before insert or update on manual_expenses
    for each row execute function fill_vat_from_gross();
drop trigger if exists trg_recruiting_costs_vat on recruiting_costs;
create trigger trg_recruiting_costs_vat before insert or update on recruiting_costs
    for each row execute function fill_vat_from_gross();

-- Backfill existing rows
update delivery_costs  set vat_rate = null where vat_rate is null;
update delivery_costs  set amount   = amount where net_amount is null;  -- retriggers
update manual_expenses set amount   = amount where net_amount is null;
update recruiting_costs set amount  = amount where net_amount is null;

-- =============================================================
-- Profile function for timeframe buckets
-- =============================================================
create or replace function tax_timeframe_start(period text) returns timestamptz as $$
    select case period
        when 'today'    then date_trunc('day',   now())
        when 'day'      then date_trunc('day',   now())
        when 'yesterday'then date_trunc('day',   now()) - interval '1 day'
        when 'week'     then date_trunc('week',  now())
        when 'month'    then date_trunc('month', now())
        when 'quarter'  then date_trunc('quarter', now())
        when 'year'     then date_trunc('year',  now())
        else date_trunc('month', now())
    end;
$$ language sql immutable;

-- =============================================================
-- VAT summary views (daily / weekly / monthly)
-- USt eingenommen  = aus paid invoices (Ist-Besteuerung) oder issued (Soll)
-- Vorsteuer gezahlt = aus expense tables
-- Zahllast          = USt - Vorsteuer
-- =============================================================
create or replace view v_vat_daily as
with d as (
    select generate_series(date_trunc('day', now()) - interval '29 days',
                           date_trunc('day', now()),
                           interval '1 day') as day
)
select
    d.day::date as day,
    coalesce((select sum(vat)      from invoices        where invoice_date = d.day::date and status = 'paid'), 0)::numeric as ust_eingenommen,
    coalesce((select sum(vat_amount) from delivery_costs  where incurred_at = d.day::date), 0)
      + coalesce((select sum(vat_amount) from manual_expenses where incurred_at = d.day::date), 0)
      + coalesce((select sum(vat_amount) from recruiting_costs where incurred_at = d.day::date), 0)::numeric as vorsteuer,
    coalesce((select sum(total)    from invoices        where invoice_date = d.day::date and status = 'paid'), 0)::numeric as umsatz_brutto
from d
order by d.day;

create or replace view v_vat_weekly as
with w as (
    select generate_series(date_trunc('week', now()) - interval '11 weeks',
                           date_trunc('week', now()),
                           interval '1 week') as week_start
)
select
    extract(week from w.week_start)::int as week,
    w.week_start::date as week_start,
    coalesce((select sum(vat)      from invoices        where invoice_date >= w.week_start and invoice_date < w.week_start + interval '7 days' and status = 'paid'), 0)::numeric as ust_eingenommen,
    coalesce((select sum(vat_amount) from delivery_costs  where incurred_at >= w.week_start::date and incurred_at < (w.week_start + interval '7 days')::date), 0)
      + coalesce((select sum(vat_amount) from manual_expenses where incurred_at >= w.week_start::date and incurred_at < (w.week_start + interval '7 days')::date), 0)
      + coalesce((select sum(vat_amount) from recruiting_costs where incurred_at >= w.week_start::date and incurred_at < (w.week_start + interval '7 days')::date), 0)::numeric as vorsteuer,
    coalesce((select sum(total)    from invoices        where invoice_date >= w.week_start and invoice_date < w.week_start + interval '7 days' and status = 'paid'), 0)::numeric as umsatz_brutto
from w
order by w.week_start;

create or replace view v_vat_monthly as
with m as (
    select generate_series(date_trunc('month', now()) - interval '11 months',
                           date_trunc('month', now()),
                           interval '1 month') as month_start
)
select
    to_char(m.month_start, 'Mon YYYY') as label,
    m.month_start::date as month_start,
    coalesce((select sum(vat)      from invoices        where invoice_date >= m.month_start and invoice_date < (m.month_start + interval '1 month') and status = 'paid'), 0)::numeric as ust_eingenommen,
    coalesce((select sum(vat_amount) from delivery_costs  where incurred_at >= m.month_start::date and incurred_at < (m.month_start + interval '1 month')::date), 0)
      + coalesce((select sum(vat_amount) from manual_expenses where incurred_at >= m.month_start::date and incurred_at < (m.month_start + interval '1 month')::date), 0)
      + coalesce((select sum(vat_amount) from recruiting_costs where incurred_at >= m.month_start::date and incurred_at < (m.month_start + interval '1 month')::date), 0)::numeric as vorsteuer,
    coalesce((select sum(total)    from invoices        where invoice_date >= m.month_start and invoice_date < (m.month_start + interval '1 month') and status = 'paid'), 0)::numeric as umsatz_brutto
from m
order by m.month_start;

-- =============================================================
-- Steuer-Rücklage: Empfehlung wie viel zurückgelegt werden sollte
-- =============================================================
create or replace view v_tax_reserves as
with s as (
    select * from tax_settings where id = 1
), m as (
    -- Gewinn = Nettoumsatz - Netto-Ausgaben (year-to-date)
    select
        coalesce((select sum(net) from invoices where status='paid' and invoice_date >= date_trunc('year', now())), 0)::numeric as net_revenue_ytd,
        coalesce((select sum(net_amount) from delivery_costs where incurred_at >= date_trunc('year', now())::date), 0)::numeric
        + coalesce((select sum(net_amount) from manual_expenses where incurred_at >= date_trunc('year', now())::date), 0)::numeric
        + coalesce((select sum(net_amount) from recruiting_costs where incurred_at >= date_trunc('year', now())::date), 0)::numeric
        + coalesce((select sum(-amount) from bank_transactions where amount < 0 and tx_date >= date_trunc('year', now())::date
                     and not exists (select 1 from invoices i where i.paid_at = bank_transactions.tx_date and i.total = -bank_transactions.amount)), 0)::numeric as net_costs_ytd
), vat as (
    select
        coalesce(sum(ust_eingenommen), 0)::numeric as ust_eingenommen_mtd,
        coalesce(sum(vorsteuer), 0)::numeric as vorsteuer_mtd
    from v_vat_monthly
    where month_start = date_trunc('month', now())::date
)
select
    vat.ust_eingenommen_mtd,
    vat.vorsteuer_mtd,
    (vat.ust_eingenommen_mtd - vat.vorsteuer_mtd) as ust_zahllast_mtd,
    m.net_revenue_ytd,
    m.net_costs_ytd,
    (m.net_revenue_ytd - m.net_costs_ytd) as profit_ytd,
    case when s.gmbh
         then round((m.net_revenue_ytd - m.net_costs_ytd) * 0.30, 2)   -- KSt+Soli+Gewerbe ~30%
         else round((m.net_revenue_ytd - m.net_costs_ytd) * (s.reserve_pct_income_tax + s.reserve_pct_gewerbesteuer) / 100, 2)
    end as ertragsteuer_ruecklage_ytd,
    s.reserve_pct_income_tax,
    s.reserve_pct_gewerbesteuer,
    s.default_vat_rate,
    s.is_regelbesteuerer,
    s.gmbh
from s, m, vat;

-- =============================================================
-- Payment outflows aggregated by timeframe
-- (bank_transactions where amount < 0 + delivery_costs + manual_expenses + recruiting_costs)
-- =============================================================
create or replace view v_outflows_daily as
with d as (
    select generate_series(date_trunc('day', now()) - interval '29 days',
                           date_trunc('day', now()),
                           interval '1 day')::date as day
)
select
    d.day,
    coalesce((select sum(-amount) from bank_transactions where tx_date = d.day and amount < 0), 0)::numeric as bank_out,
    coalesce((select sum(amount)  from delivery_costs  where incurred_at = d.day), 0)::numeric as delivery_out,
    coalesce((select sum(amount)  from manual_expenses where incurred_at = d.day), 0)::numeric as manual_out,
    coalesce((select sum(amount)  from recruiting_costs where incurred_at = d.day), 0)::numeric as recruiting_out,
    (coalesce((select sum(-amount) from bank_transactions where tx_date = d.day and amount < 0), 0)
     + coalesce((select sum(amount) from delivery_costs where incurred_at = d.day), 0)
     + coalesce((select sum(amount) from manual_expenses where incurred_at = d.day), 0)
     + coalesce((select sum(amount) from recruiting_costs where incurred_at = d.day), 0))::numeric as total_out
from d
order by d.day;

create or replace view v_outflows_weekly as
with w as (
    select generate_series(date_trunc('week', now()) - interval '11 weeks',
                           date_trunc('week', now()),
                           interval '1 week')::date as week_start
)
select
    extract(week from w.week_start)::int as week,
    w.week_start,
    coalesce((select sum(-amount) from bank_transactions where tx_date >= w.week_start and tx_date < w.week_start + 7 and amount < 0), 0)::numeric as bank_out,
    coalesce((select sum(amount)  from delivery_costs  where incurred_at >= w.week_start and incurred_at < w.week_start + 7), 0)::numeric as delivery_out,
    coalesce((select sum(amount)  from manual_expenses where incurred_at >= w.week_start and incurred_at < w.week_start + 7), 0)::numeric as manual_out,
    coalesce((select sum(amount)  from recruiting_costs where incurred_at >= w.week_start and incurred_at < w.week_start + 7), 0)::numeric as recruiting_out
from w
order by w.week_start;

create or replace view v_outflows_monthly as
with m as (
    select generate_series(date_trunc('month', now()) - interval '11 months',
                           date_trunc('month', now()),
                           interval '1 month')::date as month_start
)
select
    to_char(m.month_start, 'Mon YYYY') as label,
    m.month_start,
    coalesce((select sum(-amount) from bank_transactions where tx_date >= m.month_start and tx_date < (m.month_start + interval '1 month')::date and amount < 0), 0)::numeric as bank_out,
    coalesce((select sum(amount)  from delivery_costs  where incurred_at >= m.month_start and incurred_at < (m.month_start + interval '1 month')::date), 0)::numeric as delivery_out,
    coalesce((select sum(amount)  from manual_expenses where incurred_at >= m.month_start and incurred_at < (m.month_start + interval '1 month')::date), 0)::numeric as manual_out,
    coalesce((select sum(amount)  from recruiting_costs where incurred_at >= m.month_start and incurred_at < (m.month_start + interval '1 month')::date), 0)::numeric as recruiting_out
from m
order by m.month_start;

-- =============================================================
-- RLS
-- =============================================================
alter table tax_settings enable row level security;
drop policy if exists "read_auth"  on tax_settings;
create policy "read_auth"  on tax_settings for select to authenticated using (true);
drop policy if exists "write_auth" on tax_settings;
create policy "write_auth" on tax_settings for all to authenticated using (true) with check (true);
