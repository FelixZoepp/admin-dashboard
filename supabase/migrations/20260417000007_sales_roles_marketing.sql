-- =============================================================
-- Sales role quotas (Opener / Setter / Closer) + Marketing funnels
-- =============================================================

-- =============================================================
-- Roles: mark which Close-user plays which role (or "all")
-- =============================================================
create table if not exists sales_roles (
    user_name text primary key,                -- matches activities.user_name
    role text not null,                        -- 'opener','setter','closer','full_cycle'
    active boolean default true,
    created_at timestamptz not null default now()
);

-- Seed: default everyone as full_cycle if missing
insert into sales_roles (user_name, role)
select distinct user_name, 'full_cycle'
from activities
where user_name is not null
on conflict (user_name) do nothing;

-- =============================================================
-- Extended opportunity tracking: setting / closing sub-stages
-- Close stage names often look like "Setting — Terminiert",
-- "Setting — Follow Up", "Closing — Terminiert", "Angebot verschickt", "No Show", ...
-- We normalise them into a `stage_group` for cleaner reporting.
-- =============================================================
create or replace function sales_stage_group(stage text) returns text as $$
    select case
        when lower($1) like 'setting%'  then 'setting'
        when lower($1) like 'closing%'  then 'closing'
        when lower($1) like 'angebot%'  then 'proposal'
        when lower($1) like 'no show%'  then 'no_show'
        when lower($1) like 'follow%'   then 'follow_up'
        when lower($1) like 'qualif%'   then 'qualified'
        else 'other'
    end
$$ language sql immutable;

-- =============================================================
-- Views: role quotas and extended funnel
-- =============================================================

-- Per-person role performance (KW). Uses the sales_roles table to
-- label each user with a role, then aggregates their stage-specific
-- KPIs.
create or replace view v_sales_role_quotas as
with w as (
    select date_trunc('week', now()) as week_start
), acts as (
    select
        user_name,
        count(*) filter (where type='call' and occurred_at >= (select week_start from w))::int as anwahlen,
        count(*) filter (where type='call' and outcome='connected' and occurred_at >= (select week_start from w))::int as cc,
        count(*) filter (where type='meeting' and occurred_at >= (select week_start from w))::int as meetings
    from activities
    group by user_name
), opps as (
    select
        user_name,
        count(*) filter (where sales_stage_group(stage)='setting'  and created_at >= (select week_start from w))::int as settings_count,
        count(*) filter (where sales_stage_group(stage)='closing'  and created_at >= (select week_start from w))::int as closings_count,
        count(*) filter (where sales_stage_group(stage)='proposal' and created_at >= (select week_start from w))::int as proposals_count,
        count(*) filter (where status='won'  and won_at  >= (select week_start from w))::int as won_count,
        coalesce(sum(value) filter (where status='won' and won_at >= (select week_start from w)), 0)::numeric as won_value,
        count(*) filter (where status='lost' and lost_at >= (select week_start from w))::int as lost_count
    from (
        select o.*, coalesce(o.owner, a.user_name) as user_name_eff
        from opportunities o
        left join lateral (
            select user_name from activities
             where lead_id = o.lead_id
             order by occurred_at desc limit 1
        ) a on true
    ) t
    cross join lateral (select t.user_name_eff as user_name) u
    group by user_name
)
select
    coalesce(a.user_name, o.user_name, '—') as user_name,
    coalesce(r.role, 'full_cycle')          as role,
    coalesce(a.anwahlen, 0)                 as anwahlen,
    coalesce(a.cc, 0)                       as cc,
    case when coalesce(a.anwahlen, 0) > 0
         then round(100.0 * coalesce(a.cc, 0) / a.anwahlen, 1)
         else 0 end                         as cc_rate,
    coalesce(o.settings_count, 0)           as settings_count,
    case when coalesce(a.cc, 0) > 0
         then round(100.0 * coalesce(o.settings_count, 0) / a.cc, 1)
         else 0 end                         as quali_rate,
    coalesce(o.closings_count, 0)           as closings_count,
    coalesce(o.proposals_count, 0)          as proposals_count,
    coalesce(o.won_count, 0)                as won_count,
    case when coalesce(o.closings_count, 0) > 0
         then round(100.0 * coalesce(o.won_count, 0) / o.closings_count, 1)
         else 0 end                         as closing_rate,
    coalesce(o.won_value, 0)                as won_value,
    coalesce(o.lost_count, 0)               as lost_count
from acts a
full outer join opps o on o.user_name = a.user_name
left join sales_roles r on r.user_name = coalesce(a.user_name, o.user_name)
where coalesce(a.user_name, o.user_name) is not null
order by anwahlen desc, won_count desc;

-- Aggregate quotas by role (sum across all people holding that role)
create or replace view v_sales_role_totals as
select
    role,
    sum(anwahlen)::int      as anwahlen,
    sum(cc)::int            as cc,
    case when sum(anwahlen) > 0
         then round(100.0 * sum(cc) / sum(anwahlen), 1)
         else 0 end          as cc_rate,
    sum(settings_count)::int as settings_count,
    case when sum(cc) > 0
         then round(100.0 * sum(settings_count) / sum(cc), 1)
         else 0 end          as quali_rate,
    sum(closings_count)::int as closings_count,
    sum(won_count)::int      as won_count,
    case when sum(closings_count) > 0
         then round(100.0 * sum(won_count) / sum(closings_count), 1)
         else 0 end          as closing_rate,
    sum(won_value)::numeric  as won_value
from v_sales_role_quotas
group by role
order by
    case role when 'opener' then 1 when 'setter' then 2
              when 'closer' then 3 when 'full_cycle' then 4 else 5 end;

-- Extended funnel with proposal + no_show + follow_up breakdown
create or replace view v_sales_funnel_detailed as
select stage, count, value, ord from (
    values
        ('Anwahlen'::text, 1::int,
            (select count(*)::int from activities where type='call' and occurred_at >= date_trunc('week', now())),
            null::numeric),
        ('CC', 2,
            (select count(*)::int from activities where type='call' and outcome='connected' and occurred_at >= date_trunc('week', now())),
            null::numeric),
        ('Setting', 3,
            (select count(*)::int from opportunities where sales_stage_group(stage)='setting' and (created_at >= date_trunc('week', now()) or won_at >= date_trunc('week', now()))),
            null::numeric),
        ('Closing', 4,
            (select count(*)::int from opportunities where sales_stage_group(stage)='closing' and (created_at >= date_trunc('week', now()) or won_at >= date_trunc('week', now()))),
            null::numeric),
        ('Angebot', 5,
            (select count(*)::int from opportunities where sales_stage_group(stage)='proposal' and (created_at >= date_trunc('week', now()) or won_at >= date_trunc('week', now()))),
            null::numeric),
        ('No Show', 6,
            (select count(*)::int from opportunities where sales_stage_group(stage)='no_show' and (created_at >= date_trunc('week', now()) or won_at >= date_trunc('week', now()))),
            null::numeric),
        ('Won', 7,
            (select count(*)::int from opportunities where status='won' and won_at >= date_trunc('week', now())),
            (select coalesce(sum(value),0)::numeric from opportunities where status='won' and won_at >= date_trunc('week', now())))
) as t(stage, ord, count, value)
order by ord;

-- =============================================================
-- Marketing: Perspective funnels + OnePage landing pages + CopeCart
-- =============================================================
create table if not exists landing_pages (
    id text primary key,
    platform text not null,                    -- 'perspective','onepage','other'
    name text not null,
    url text,
    status text,                               -- 'active','draft','paused'
    created_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_lp_platform on landing_pages (platform);

create table if not exists lp_metrics_daily (
    page_id text references landing_pages (id) on delete cascade,
    metric_date date not null,
    platform text not null,
    views int default 0,
    unique_visitors int default 0,
    opt_ins int default 0,                     -- form submissions / leads
    conversion_rate numeric(6, 4),
    synced_at timestamptz not null default now(),
    primary key (page_id, metric_date)
);
create index if not exists idx_lp_metrics_date on lp_metrics_daily (metric_date desc);

-- CopeCart sales
create table if not exists copecart_products (
    id text primary key,
    name text not null,
    price_gross numeric(12,2),
    currency text default 'EUR',
    synced_at timestamptz not null default now()
);

create table if not exists copecart_sales (
    id text primary key,
    product_id text references copecart_products (id) on delete set null,
    buyer_email text,
    amount numeric(12,2),
    currency text default 'EUR',
    status text,                               -- 'paid','pending','refunded','chargeback'
    source text,                               -- affiliate / utm / funnel id
    sold_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_copecart_sold_at on copecart_sales (sold_at desc);
create index if not exists idx_copecart_status on copecart_sales (status);

-- =============================================================
-- RLS for new tables
-- =============================================================
alter table sales_roles enable row level security;
alter table landing_pages enable row level security;
alter table lp_metrics_daily enable row level security;
alter table copecart_products enable row level security;
alter table copecart_sales enable row level security;

do $$
declare t text;
begin
    for t in
        select unnest(array[
            'sales_roles','landing_pages','lp_metrics_daily',
            'copecart_products','copecart_sales'
        ])
    loop
        execute format('drop policy if exists "read_auth" on %I', t);
        execute format('create policy "read_auth" on %I for select to authenticated using (true)', t);
        execute format('drop policy if exists "write_auth" on %I', t);
        execute format('create policy "write_auth" on %I for all to authenticated using (true) with check (true)', t);
    end loop;
end$$;
