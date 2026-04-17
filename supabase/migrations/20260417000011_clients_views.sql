-- =============================================================
-- Client profitability views
-- =============================================================

-- Monatlicher Umsatz je Kunde (aus aktiven Retainer-Verträgen)
create or replace view v_client_monthly_revenue as
select
    c.id as client_id,
    c.name,
    coalesce(sum(ct.monthly_value) filter (where ct.active and ct.type = 'retainer'), 0)::numeric as mrr,
    coalesce(sum(ct.monthly_value) filter (where ct.active and ct.type = 'retainer') * 12, 0)::numeric as arr
from clients c
left join contracts ct on ct.client_id = c.id
group by c.id, c.name;

-- Stunden pro Kunde (Monat)
create or replace view v_client_hours_month as
select
    c.id as client_id,
    c.name,
    coalesce(sum(t.duration_seconds) / 3600.0, 0)::numeric(10, 2) as hours_month,
    coalesce(sum(t.duration_seconds * coalesce(t.hourly_cost, 0)) / 3600.0, 0)::numeric(12, 2) as labor_cost_month
from clients c
left join time_entries t on t.client_id = c.id
    and t.started_at >= date_trunc('month', now())
group by c.id, c.name;

-- Delivery costs pro Kunde (Monat)
create or replace view v_client_delivery_cost_month as
select
    c.id as client_id,
    c.name,
    coalesce(sum(d.amount), 0)::numeric as delivery_cost_month,
    count(d.id)::int as cost_entries_month
from clients c
left join delivery_costs d on d.client_id = c.id
    and d.incurred_at >= date_trunc('month', now())::date
group by c.id, c.name;

-- Deliverables pro Kunde (Monat)
create or replace view v_client_deliverables_month as
select
    c.id as client_id,
    c.name,
    count(d.id)::int as deliverables_total,
    count(d.id) filter (where d.status = 'published' and d.published_at >= date_trunc('month', now()))::int as published_month,
    count(d.id) filter (where d.status in ('planned', 'in_progress', 'review'))::int as in_progress
from clients c
left join deliverables d on d.client_id = c.id
group by c.id, c.name;

-- ============================================================================
-- MASTER VIEW: Profitability per Client (current month)
-- ============================================================================
create or replace view v_client_profitability as
select
    c.id,
    c.name,
    c.status,
    c.account_manager,
    c.onboarded_at,
    (current_date - c.onboarded_at)::int as days_active,
    r.mrr,
    r.arr,
    coalesce(h.hours_month, 0)          as hours_month,
    coalesce(h.labor_cost_month, 0)     as labor_cost_month,
    coalesce(dc.delivery_cost_month, 0) as delivery_cost_month,
    (coalesce(h.labor_cost_month, 0) + coalesce(dc.delivery_cost_month, 0))::numeric as total_cost_month,
    (coalesce(r.mrr, 0) - coalesce(h.labor_cost_month, 0) - coalesce(dc.delivery_cost_month, 0))::numeric as margin_month,
    case when coalesce(r.mrr, 0) > 0
         then round(100.0 *
              (coalesce(r.mrr, 0) - coalesce(h.labor_cost_month, 0) - coalesce(dc.delivery_cost_month, 0))
              / r.mrr, 1)
         else null end                  as margin_pct,
    case when coalesce(h.labor_cost_month, 0) + coalesce(dc.delivery_cost_month, 0) > 0
         then round(
              coalesce(r.mrr, 0)
              / (coalesce(h.labor_cost_month, 0) + coalesce(dc.delivery_cost_month, 0))::numeric,
              2)
         else null end                  as roi_multiple,
    case when coalesce(h.hours_month, 0) > 0
         then round(coalesce(r.mrr, 0) / h.hours_month, 2)
         else null end                  as effective_hourly_rate,
    coalesce(dl.published_month, 0)     as posts_published_month,
    coalesce(dl.in_progress, 0)         as posts_in_progress,
    case when coalesce(dl.published_month, 0) > 0
         then round(coalesce(h.hours_month, 0) / dl.published_month, 2)
         else null end                  as avg_hours_per_post
from clients c
left join v_client_monthly_revenue       r  on r.client_id  = c.id
left join v_client_hours_month           h  on h.client_id  = c.id
left join v_client_delivery_cost_month   dc on dc.client_id = c.id
left join v_client_deliverables_month    dl on dl.client_id = c.id
where c.status = 'active'
order by margin_month desc;

-- Aggregierte KPIs für Overview-Card
create or replace view v_clients_kpis as
select
    (select count(*) from clients where status = 'active')::int as active_clients,
    coalesce((select sum(mrr) from v_client_monthly_revenue), 0)::numeric as total_mrr,
    coalesce((select sum(hours_month) from v_client_hours_month), 0)::numeric as total_hours_month,
    coalesce((select sum(labor_cost_month) from v_client_hours_month), 0)::numeric as total_labor_cost_month,
    coalesce((select sum(delivery_cost_month) from v_client_delivery_cost_month), 0)::numeric as total_delivery_cost_month,
    coalesce((select sum(margin_month) from v_client_profitability), 0)::numeric as total_margin_month,
    coalesce((select count(*) from v_client_profitability where margin_month < 0), 0)::int as clients_unprofitable,
    coalesce((select count(*) from v_client_profitability where margin_pct >= 50), 0)::int as clients_high_margin;

-- Stunden pro Mitarbeiter (Monat) — für Team-Auslastung
create or replace view v_team_hours_month as
select
    coalesce(t.member_id::text, t.member_name, '—') as member_key,
    coalesce(m.name, t.member_name, '—')            as member_name,
    m.role,
    m.hourly_cost,
    coalesce(sum(t.duration_seconds) / 3600.0, 0)::numeric(10, 2) as hours_month,
    coalesce(sum(t.duration_seconds) filter (where t.billable) / 3600.0, 0)::numeric(10, 2) as billable_hours_month,
    count(distinct t.client_id) filter (where t.client_id is not null)::int as clients_served,
    coalesce(sum(t.duration_seconds * coalesce(t.hourly_cost, 0)) / 3600.0, 0)::numeric(12, 2) as total_cost_month
from time_entries t
left join team_members m on m.id = t.member_id
where t.started_at >= date_trunc('month', now())
group by member_key, member_name, m.role, m.hourly_cost
order by hours_month desc;

-- Detail: Stunden eines bestimmten Kunden nach Mitarbeiter (Monat)
create or replace view v_client_hours_by_member as
select
    t.client_id,
    coalesce(m.name, t.member_name, '—') as member_name,
    sum(t.duration_seconds) / 3600.0     as hours,
    sum(t.duration_seconds * coalesce(t.hourly_cost, 0)) / 3600.0 as cost
from time_entries t
left join team_members m on m.id = t.member_id
where t.started_at >= date_trunc('month', now())
group by t.client_id, member_name
order by t.client_id, hours desc;

-- Delivery-Kosten-Breakdown pro Kunde
create or replace view v_client_costs_breakdown as
select
    client_id,
    category,
    count(*)::int            as entries,
    sum(amount)::numeric     as total,
    min(incurred_at)         as first_seen,
    max(incurred_at)         as last_seen
from delivery_costs
where incurred_at >= date_trunc('month', now())::date
group by client_id, category
order by client_id, total desc;

-- ============================================================================
-- Steuer-Export: Alle Kosten + Einnahmen mit Datum, Beleg, Kategorie
-- ============================================================================
create or replace view v_tax_ledger as
-- Einnahmen aus Rechnungen (Easybill)
select
    invoice_date    as entry_date,
    'income'        as type,
    'invoice'       as source,
    number          as reference,
    customer_name   as counterparty,
    'Rechnung'      as category,
    total           as amount,
    currency,
    status          as extra
from invoices
where invoice_date is not null
union all
-- Einnahmen manuell
select received_at, 'income', 'manual', id::text, source, 'Manuell', amount, currency, origin
  from manual_income
union all
-- Delivery-Kosten pro Kunde
select dc.incurred_at, 'expense', 'delivery', dc.invoice_number, c.name, dc.category, dc.amount, dc.currency, dc.description
  from delivery_costs dc
  left join clients c on c.id = dc.client_id
union all
-- Allgemeine manuelle Ausgaben
select incurred_at, 'expense', 'manual', id::text, vendor, category, amount, currency, description
  from manual_expenses
union all
-- Recruiting-Kosten
select incurred_at, 'expense', 'recruiting', id::text, null, category, amount, currency, description
  from recruiting_costs
order by entry_date desc;
