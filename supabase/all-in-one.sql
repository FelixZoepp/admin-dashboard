-- ==========================================================
-- Content Leads Dashboard - Complete Setup (migrations + seed)
-- One-shot: paste this whole file into Supabase SQL Editor & Run.
-- (Cron migrations excluded; run separately after setting app.settings.*)
-- ==========================================================

-- ==== 20260417000001_schema.sql ====
-- =============================================================
-- Content Leads Dashboard — Core Schema
-- =============================================================

create extension if not exists "pgcrypto";

-- =============================================================
-- Sync audit log (one row per integration run)
-- =============================================================
create table if not exists sync_runs (
    id uuid primary key default gen_random_uuid(),
    source text not null,                      -- 'close','monday','easybill','qonto','meta','instagram','linkedin'
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    status text not null default 'running',    -- 'running','success','error'
    rows_processed int default 0,
    message text
);
create index if not exists idx_sync_runs_source_time on sync_runs (source, started_at desc);

-- =============================================================
-- Close CRM
-- =============================================================
create table if not exists leads (
    id text primary key,                       -- Close lead id
    name text,
    email text,
    phone text,
    source text,
    status text,
    owner text,
    custom jsonb default '{}'::jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_leads_status on leads (status);
create index if not exists idx_leads_owner on leads (owner);

create table if not exists opportunities (
    id text primary key,
    lead_id text references leads (id) on delete cascade,
    lead_name text,
    pipeline text,
    stage text,
    value numeric(12, 2),
    currency text default 'EUR',
    owner text,
    status text,                               -- 'active','won','lost'
    won_at timestamptz,
    lost_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_opps_stage on opportunities (stage);
create index if not exists idx_opps_status on opportunities (status);
create index if not exists idx_opps_won_at on opportunities (won_at);

create table if not exists activities (
    id text primary key,
    lead_id text,
    type text,                                 -- 'call','email','meeting','note'
    direction text,                            -- 'incoming','outgoing'
    outcome text,                              -- for calls: 'connected','no_answer','voicemail'
    user_name text,
    occurred_at timestamptz,
    duration_seconds int,
    synced_at timestamptz not null default now()
);
create index if not exists idx_activities_type_time on activities (type, occurred_at);
create index if not exists idx_activities_user on activities (user_name);

-- =============================================================
-- Monday.com — Fulfillment
-- =============================================================
create table if not exists monday_boards (
    board_id text primary key,
    name text not null,
    synced_at timestamptz not null default now()
);

create table if not exists fulfillment_items (
    id text primary key,
    board_id text references monday_boards (board_id) on delete cascade,
    name text,
    status text,                               -- 'open','in_progress','done','overdue'
    category text,                             -- 'daily','weekly','monthly' or custom
    assignee text,
    due_date date,
    completed_at timestamptz,
    created_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_fulfillment_status on fulfillment_items (status);
create index if not exists idx_fulfillment_completed on fulfillment_items (completed_at);
create index if not exists idx_fulfillment_assignee on fulfillment_items (assignee);

-- =============================================================
-- Easybill
-- =============================================================
create table if not exists invoices (
    id text primary key,
    number text,
    customer_name text,
    customer_id text,
    total numeric(12, 2),
    net numeric(12, 2),
    vat numeric(12, 2),
    status text,                               -- 'draft','open','paid','overdue','cancelled'
    invoice_date date,
    due_date date,
    paid_at date,
    currency text default 'EUR',
    synced_at timestamptz not null default now()
);
create index if not exists idx_invoices_status on invoices (status);
create index if not exists idx_invoices_due on invoices (due_date);
create index if not exists idx_invoices_date on invoices (invoice_date);

-- =============================================================
-- Qonto — Banking
-- =============================================================
create table if not exists bank_accounts (
    id text primary key,
    name text,
    iban text,
    balance numeric(14, 2),
    currency text default 'EUR',
    synced_at timestamptz not null default now()
);

create table if not exists bank_transactions (
    id text primary key,
    account_id text references bank_accounts (id) on delete cascade,
    amount numeric(12, 2),
    currency text default 'EUR',
    label text,
    counterparty text,
    category text,
    tx_date date,
    settled_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_bank_tx_date on bank_transactions (tx_date desc);

-- =============================================================
-- Meta Ads
-- =============================================================
create table if not exists ad_campaigns (
    id text primary key,
    name text,
    objective text,
    status text,
    daily_budget numeric(12, 2),
    synced_at timestamptz not null default now()
);

create table if not exists ad_metrics_daily (
    campaign_id text references ad_campaigns (id) on delete cascade,
    metric_date date not null,
    impressions int default 0,
    clicks int default 0,
    spend numeric(12, 2) default 0,
    leads int default 0,
    ctr numeric(6, 4),
    cpm numeric(10, 2),
    cpl numeric(10, 2),
    synced_at timestamptz not null default now(),
    primary key (campaign_id, metric_date)
);
create index if not exists idx_ad_metrics_date on ad_metrics_daily (metric_date desc);

-- =============================================================
-- Instagram & LinkedIn — Social
-- =============================================================
create table if not exists social_posts (
    id text primary key,
    platform text not null,                    -- 'instagram','linkedin','youtube'
    post_type text,                            -- 'post','reel','story','video'
    permalink text,
    caption text,
    published_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_social_posts_platform_date on social_posts (platform, published_at desc);

create table if not exists social_metrics_daily (
    post_id text references social_posts (id) on delete cascade,
    metric_date date not null,
    platform text not null,
    impressions int default 0,
    reach int default 0,
    engagement int default 0,
    likes int default 0,
    comments int default 0,
    shares int default 0,
    saves int default 0,
    video_views int default 0,
    synced_at timestamptz not null default now(),
    primary key (post_id, metric_date)
);

create table if not exists social_account_metrics_daily (
    platform text not null,                    -- 'instagram','linkedin','youtube'
    metric_date date not null,
    followers int,
    profile_views int,
    story_views int,
    reach int,
    impressions int,
    synced_at timestamptz not null default now(),
    primary key (platform, metric_date)
);

-- =============================================================
-- Coaching clients
-- =============================================================
create table if not exists coaching_clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    program text,
    joined_at date,
    active boolean default true,
    created_at timestamptz not null default now()
);

create table if not exists client_submissions (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references coaching_clients (id) on delete cascade,
    week_start date not null,
    revenue numeric(12, 2) default 0,
    new_leads int default 0,
    booked_calls int default 0,
    closes int default 0,
    notes text,
    created_at timestamptz not null default now(),
    unique (client_id, week_start)
);
create index if not exists idx_subs_week on client_submissions (week_start desc);

-- =============================================================
-- Share tokens (for signed read-only links)
-- =============================================================
create table if not exists share_tokens (
    token text primary key,
    tab text not null,
    created_by uuid,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked boolean default false
);

-- ==== 20260417000002_views.sql ====
-- =============================================================
-- Dashboard Views — KPI aggregations for the UI
-- =============================================================

-- ============ Sales ============
create or replace view v_sales_funnel_week as
with base as (
    select
        (count(*) filter (where type = 'call' and occurred_at >= date_trunc('week', now())))::int as anwahlen,
        (count(*) filter (where type = 'call' and outcome = 'connected' and occurred_at >= date_trunc('week', now())))::int as cc
    from activities
), opps as (
    select
        (count(*) filter (where stage ilike 'setting%' and created_at >= date_trunc('week', now())))::int as settings,
        (count(*) filter (where stage ilike 'closing%' and created_at >= date_trunc('week', now())))::int as closings,
        (count(*) filter (where status = 'won' and won_at >= date_trunc('week', now())))::int as won_count,
        coalesce(sum(value) filter (where status = 'won' and won_at >= date_trunc('week', now())), 0)::numeric as won_value
    from opportunities
)
select 'Anwahlen' as stage, anwahlen as count, 100.0 as pct, null::numeric as value, 1 as ord from base
union all
select 'CC', cc, case when anwahlen > 0 then round(100.0 * cc / anwahlen, 1) else 0 end, null::numeric, 2 from base, opps
union all
select 'Settings', settings, case when anwahlen > 0 then round(100.0 * settings / anwahlen, 1) else 0 end, null::numeric, 3 from base, opps
union all
select 'Closing', closings, case when anwahlen > 0 then round(100.0 * closings / anwahlen, 1) else 0 end, null::numeric, 4 from base, opps
union all
select 'Won', won_count, case when anwahlen > 0 then round(100.0 * won_count / anwahlen, 1) else 0 end, won_value, 5 from base, opps
order by ord;

create or replace view v_sales_weekly_trend as
select
    extract(week from occurred_at)::int as week,
    count(*) filter (where type = 'call')::int as calls,
    count(*) filter (where type = 'call' and outcome = 'connected')::int as connected
from activities
where occurred_at >= now() - interval '8 weeks'
group by 1
order by 1;

create or replace view v_won_deals_month as
select
    id,
    lead_name,
    value,
    owner,
    won_at
from opportunities
where status = 'won' and won_at >= date_trunc('month', now())
order by won_at desc;

create or replace view v_pipeline_by_stage as
select
    coalesce(stage, 'Unbekannt') as stage,
    count(*)::int as count,
    coalesce(sum(value), 0)::numeric as value
from opportunities
where status = 'active'
group by 1
order by value desc;

-- ============ Fulfillment ============
create or replace view v_fulfillment_kpis as
select
    (count(*) filter (where status = 'done' and completed_at::date = current_date))::int as done_today,
    (count(*) filter (where status = 'done' and completed_at >= date_trunc('week', now())))::int as done_week,
    (count(*) filter (where status = 'done' and completed_at >= date_trunc('week', now())) / greatest(extract(isodow from now())::int, 1))::int as avg_per_day,
    (count(*) filter (where status in ('open', 'in_progress')))::int as open_count
from fulfillment_items;

create or replace view v_fulfillment_by_day as
with days as (
    select generate_series(1, 5) as dow
)
select
    case dow
        when 1 then 'Montag' when 2 then 'Dienstag' when 3 then 'Mittwoch'
        when 4 then 'Donnerstag' when 5 then 'Freitag'
    end as weekday,
    dow,
    coalesce((
        select count(*)
        from fulfillment_items
        where status = 'done'
          and completed_at >= date_trunc('week', now())
          and extract(isodow from completed_at)::int = dow
    ), 0)::int as count
from days
order by dow;

create or replace view v_fulfillment_weekly as
select
    extract(week from completed_at)::int as week,
    count(*)::int as count
from fulfillment_items
where status = 'done' and completed_at >= now() - interval '5 weeks'
group by 1
order by 1;

create or replace view v_fulfillment_by_category as
select
    coalesce(category, 'Sonstige') as category,
    count(*)::int as count
from fulfillment_items
where status in ('open', 'in_progress')
group by 1
order by 2 desc;

-- ============ Marketing ============
create or replace view v_marketing_overview as
select
    (select count(*)::int from social_posts where published_at >= date_trunc('week', now())) as posts_week,
    coalesce((select sum(impressions)::int from social_metrics_daily where metric_date >= date_trunc('week', now())::date), 0) as impressions_week,
    coalesce((select sum(engagement)::int from social_metrics_daily where metric_date >= date_trunc('week', now())::date), 0) as engagement_week,
    coalesce((select sum(leads)::int from ad_metrics_daily where metric_date >= date_trunc('week', now())::date), 0) as leads_week;

create or replace view v_meta_ads_week as
select
    coalesce(sum(spend), 0)::numeric as spend,
    coalesce(sum(impressions), 0)::int as impressions,
    coalesce(sum(clicks), 0)::int as clicks,
    case when coalesce(sum(leads), 0) > 0
        then round(sum(spend) / sum(leads), 2) else null end as cpl
from ad_metrics_daily
where metric_date >= date_trunc('week', now())::date;

create or replace view v_instagram_week as
select
    coalesce(sum(m.reach), 0)::int as reach,
    coalesce(sum(m.engagement), 0)::int as engagement,
    coalesce((select followers from social_account_metrics_daily where platform = 'instagram' order by metric_date desc limit 1), 0) as followers,
    coalesce((select story_views from social_account_metrics_daily where platform = 'instagram' order by metric_date desc limit 1), 0) as story_views
from social_metrics_daily m
where m.platform = 'instagram' and m.metric_date >= date_trunc('week', now())::date;

create or replace view v_linkedin_week as
select
    coalesce(sum(m.impressions), 0)::int as impressions,
    coalesce(sum(m.engagement), 0)::int as engagement,
    coalesce((select followers from social_account_metrics_daily where platform = 'linkedin' order by metric_date desc limit 1), 0) as followers,
    coalesce((select profile_views from social_account_metrics_daily where platform = 'linkedin' order by metric_date desc limit 1), 0) as profile_views
from social_metrics_daily m
where m.platform = 'linkedin' and m.metric_date >= date_trunc('week', now())::date;

-- ============ Finance ============
create or replace view v_finance_kpis as
select
    coalesce((
        select sum(total) from invoices
        where status = 'paid' and invoice_date >= date_trunc('month', now())
    ), 0)::numeric as revenue_mtd,
    coalesce((
        select sum(total) from invoices where status in ('open', 'overdue')
    ), 0)::numeric as unpaid_total,
    coalesce((
        select count(*) from invoices where status in ('open', 'overdue')
    ), 0)::int as unpaid_count,
    0::numeric as mrr;

create or replace view v_revenue_monthly as
select
    to_char(date_trunc('month', invoice_date), 'Mon') as label,
    date_trunc('month', invoice_date) as month,
    coalesce(sum(total), 0)::numeric as revenue
from invoices
where status = 'paid'
  and invoice_date >= (date_trunc('month', now()) - interval '5 months')
group by 1, 2
order by 2;

create or replace view v_qonto_summary as
select
    coalesce((select sum(balance) from bank_accounts), 0)::numeric as balance,
    coalesce((
        select jsonb_agg(jsonb_build_object('date', tx_date, 'label', label, 'amount', amount) order by tx_date desc)
        from (
            select tx_date, label, amount
            from bank_transactions
            order by tx_date desc
            limit 20
        ) t
    ), '[]'::jsonb) as recent_tx;

-- ============ Team ============
create or replace view v_team_kpis as
select
    (select count(*) from fulfillment_items where status in ('open', 'in_progress'))::int as open_tasks,
    (select count(*) from fulfillment_items where status = 'done' and completed_at >= date_trunc('week', now()))::int as done_week,
    (select count(*) from fulfillment_items where status in ('open', 'in_progress') and due_date < current_date)::int as overdue,
    (select count(*) from monday_boards)::int as boards_count;

create or replace view v_team_boards as
select
    b.board_id,
    b.name,
    count(i.id) filter (where i.status in ('open', 'in_progress'))::int as items_open,
    count(i.id) filter (where i.status = 'done')::int as items_done,
    count(i.id)::int as items_total
from monday_boards b
left join fulfillment_items i on i.board_id = b.board_id
group by b.board_id, b.name
order by b.name;

create or replace view v_team_workload as
select
    coalesce(assignee, '—') as person,
    count(*) filter (where status in ('open', 'in_progress'))::int as tasks_open,
    count(*) filter (where status = 'done' and completed_at >= date_trunc('week', now()))::int as tasks_done_week
from fulfillment_items
where assignee is not null
group by 1
order by tasks_done_week desc, tasks_open desc;

-- ============ Coaching ============
create or replace view v_coaching_kpis as
select
    (select count(*) from coaching_clients where active = true)::int as active_clients,
    (select count(*) from client_submissions where week_start >= date_trunc('week', now())::date)::int as submissions_week,
    coalesce((select sum(revenue) from client_submissions where week_start >= date_trunc('week', now())::date), 0)::numeric as total_revenue_week,
    coalesce((select sum(new_leads) from client_submissions where week_start >= date_trunc('week', now())::date), 0)::int as total_leads_week;

create or replace view v_coaching_recent_submissions as
select
    s.id,
    c.name as client_name,
    s.revenue,
    s.new_leads,
    s.booked_calls,
    s.closes,
    s.week_start,
    s.notes
from client_submissions s
join coaching_clients c on c.id = s.client_id
order by s.week_start desc, c.name;

-- ============ Overview ============
create or replace view v_overview_kpis as
select
    (select revenue_mtd from v_finance_kpis) as "revenueMTD",
    15000::numeric as "revenueTarget",
    coalesce((select sum(value) from opportunities where status = 'active'), 0)::numeric as "pipelineValue",
    coalesce((select count(*) from opportunities where status = 'active'), 0)::int as "pipelineCount",
    (select balance from v_qonto_summary) as "bankBalance",
    (select unpaid_total from v_finance_kpis) as "unpaidInvoices",
    (select unpaid_count from v_finance_kpis) as "unpaidInvoicesCount",
    coalesce((select sum(spend) from ad_metrics_daily where metric_date = current_date), 0)::numeric as "adSpendToday",
    (select open_tasks from v_team_kpis) as "fulfillmentOpen",
    (select active_clients from v_coaching_kpis) as "coachingActive",
    (select submissions_week from v_coaching_kpis) as "coachingSubmissionsWeek",
    coalesce(
        (select sum(reach) from social_metrics_daily where metric_date >= date_trunc('week', now())::date),
        0
    )::int as "socialReachWeek",
    to_char(
        (select max(finished_at) from sync_runs where status = 'success'),
        'DD.MM.YYYY HH24:MI'
    ) as "lastSync";

-- ==== 20260417000003_rls.sql ====
-- =============================================================
-- Row Level Security — authenticated users only
-- Service role bypasses RLS (used by Edge Functions for ETL).
-- =============================================================

alter table sync_runs enable row level security;
alter table leads enable row level security;
alter table opportunities enable row level security;
alter table activities enable row level security;
alter table monday_boards enable row level security;
alter table fulfillment_items enable row level security;
alter table invoices enable row level security;
alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_metrics_daily enable row level security;
alter table social_posts enable row level security;
alter table social_metrics_daily enable row level security;
alter table social_account_metrics_daily enable row level security;
alter table coaching_clients enable row level security;
alter table client_submissions enable row level security;
alter table share_tokens enable row level security;

-- Read access for any authenticated user
do $$
declare t text;
begin
    for t in
        select unnest(array[
            'sync_runs', 'leads', 'opportunities', 'activities',
            'monday_boards', 'fulfillment_items', 'invoices',
            'bank_accounts', 'bank_transactions',
            'ad_campaigns', 'ad_metrics_daily',
            'social_posts', 'social_metrics_daily', 'social_account_metrics_daily',
            'coaching_clients', 'client_submissions', 'share_tokens'
        ])
    loop
        execute format('drop policy if exists "read_auth" on %I', t);
        execute format('create policy "read_auth" on %I for select to authenticated using (true)', t);
    end loop;
end$$;

-- Coaching submissions: authenticated users can insert + update
drop policy if exists "write_auth_submissions" on client_submissions;
create policy "write_auth_submissions" on client_submissions
    for insert to authenticated with check (true);

drop policy if exists "update_auth_submissions" on client_submissions;
create policy "update_auth_submissions" on client_submissions
    for update to authenticated using (true) with check (true);

-- Coaching clients: authenticated users can insert
drop policy if exists "write_auth_clients" on coaching_clients;
create policy "write_auth_clients" on coaching_clients
    for insert to authenticated with check (true);

-- ==== 20260417000005_outreach_recruiting.sql ====
-- =============================================================
-- Outreach (Instantly) + Recruiting + extended Banking
-- =============================================================

-- =============================================================
-- Outreach — Instantly email campaigns
-- =============================================================
create table if not exists outreach_campaigns (
    id text primary key,                       -- Instantly campaign id
    name text not null,
    status text,                               -- 'active','paused','completed'
    daily_limit int,
    created_at timestamptz,
    synced_at timestamptz not null default now()
);

create table if not exists outreach_leads (
    id text primary key,                       -- Instantly lead id
    campaign_id text references outreach_campaigns (id) on delete cascade,
    email text,
    first_name text,
    last_name text,
    company text,
    status text,                               -- 'pending','contacted','opened','replied','bounced','unsubscribed'
    last_contacted_at timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_outreach_leads_status on outreach_leads (status);
create index if not exists idx_outreach_leads_contacted on outreach_leads (last_contacted_at desc);

create table if not exists outreach_metrics_daily (
    campaign_id text references outreach_campaigns (id) on delete cascade,
    metric_date date not null,
    sent int default 0,
    opened int default 0,
    replied int default 0,
    bounced int default 0,
    unsubscribed int default 0,
    positive_replies int default 0,
    synced_at timestamptz not null default now(),
    primary key (campaign_id, metric_date)
);
create index if not exists idx_outreach_metrics_date on outreach_metrics_daily (metric_date desc);

-- =============================================================
-- Recruiting
-- =============================================================
create table if not exists recruiting_positions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    department text,
    status text default 'open',                -- 'open','filled','closed'
    opened_at date default current_date,
    target_hire_date date,
    budget_gross numeric(12, 2),
    created_at timestamptz not null default now()
);

create table if not exists recruiting_applications (
    id uuid primary key default gen_random_uuid(),
    position_id uuid references recruiting_positions (id) on delete cascade,
    candidate_name text not null,
    email text,
    phone text,
    source text,                               -- 'linkedin','indeed','referral','website','other'
    stage text not null default 'new',         -- 'new','screening','interview','trial','offer','hired','rejected','withdrew'
    applied_at timestamptz not null default now(),
    screened_at timestamptz,
    interviewed_at timestamptz,
    trial_started_at timestamptz,
    trial_ended_at timestamptz,
    offered_at timestamptz,
    hired_at timestamptz,
    rejected_at timestamptz,
    rejection_reason text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_recruiting_apps_position on recruiting_applications (position_id);
create index if not exists idx_recruiting_apps_stage on recruiting_applications (stage);
create index if not exists idx_recruiting_apps_date on recruiting_applications (applied_at desc);

create table if not exists recruiting_costs (
    id uuid primary key default gen_random_uuid(),
    application_id uuid references recruiting_applications (id) on delete cascade,
    position_id uuid references recruiting_positions (id) on delete cascade,
    category text not null,                    -- 'interview','trial_day','ad_spend','tool','agency','other'
    description text,
    amount numeric(12, 2) not null,
    currency text default 'EUR',
    incurred_at date default current_date,
    created_at timestamptz not null default now()
);
create index if not exists idx_recruiting_costs_category on recruiting_costs (category);
create index if not exists idx_recruiting_costs_date on recruiting_costs (incurred_at desc);

-- =============================================================
-- Banking — add institution + source to support Commerzbank
-- =============================================================
alter table bank_accounts
    add column if not exists institution text default 'qonto',
    add column if not exists source text default 'api';  -- 'api','csv','hbci'

alter table bank_transactions
    add column if not exists institution text default 'qonto',
    add column if not exists direction text;              -- 'in','out','internal' (computed from sign + counterparty)

create index if not exists idx_bank_tx_institution on bank_transactions (institution, tx_date desc);
create index if not exists idx_bank_tx_direction on bank_transactions (direction);

-- Helper: recompute direction from amount sign where null
update bank_transactions
   set direction = case when amount >= 0 then 'in' else 'out' end
 where direction is null;

-- =============================================================
-- RLS for new tables
-- =============================================================
alter table outreach_campaigns enable row level security;
alter table outreach_leads enable row level security;
alter table outreach_metrics_daily enable row level security;
alter table recruiting_positions enable row level security;
alter table recruiting_applications enable row level security;
alter table recruiting_costs enable row level security;

do $$
declare t text;
begin
    for t in
        select unnest(array[
            'outreach_campaigns','outreach_leads','outreach_metrics_daily',
            'recruiting_positions','recruiting_applications','recruiting_costs'
        ])
    loop
        execute format('drop policy if exists "read_auth" on %I', t);
        execute format('create policy "read_auth" on %I for select to authenticated using (true)', t);
        execute format('drop policy if exists "write_auth" on %I', t);
        execute format('create policy "write_auth" on %I for all to authenticated using (true) with check (true)', t);
    end loop;
end$$;

-- ==== 20260417000006_outreach_recruiting_views.sql ====
-- =============================================================
-- Views for Outreach + Recruiting + extended Finance (inflows/outflows)
-- =============================================================

-- ============ Outreach ============
create or replace view v_outreach_kpis as
select
    coalesce(sum(sent)    filter (where metric_date >= date_trunc('week', now())::date), 0)::int as sent_week,
    coalesce(sum(opened)  filter (where metric_date >= date_trunc('week', now())::date), 0)::int as opened_week,
    coalesce(sum(replied) filter (where metric_date >= date_trunc('week', now())::date), 0)::int as replied_week,
    coalesce(sum(positive_replies) filter (where metric_date >= date_trunc('week', now())::date), 0)::int as positive_week,
    coalesce(sum(bounced) filter (where metric_date >= date_trunc('week', now())::date), 0)::int as bounced_week,
    case when sum(sent) filter (where metric_date >= date_trunc('week', now())::date) > 0
         then round(100.0 * sum(opened)  filter (where metric_date >= date_trunc('week', now())::date)
                         / sum(sent)    filter (where metric_date >= date_trunc('week', now())::date), 1)
         else 0 end as open_rate,
    case when sum(sent) filter (where metric_date >= date_trunc('week', now())::date) > 0
         then round(100.0 * sum(replied) filter (where metric_date >= date_trunc('week', now())::date)
                         / sum(sent)    filter (where metric_date >= date_trunc('week', now())::date), 1)
         else 0 end as reply_rate
from outreach_metrics_daily;

create or replace view v_outreach_campaigns as
select
    c.id,
    c.name,
    c.status,
    coalesce((select count(*) from outreach_leads l where l.campaign_id = c.id), 0)::int as leads_total,
    coalesce((select count(*) from outreach_leads l where l.campaign_id = c.id and l.status = 'replied'), 0)::int as leads_replied,
    coalesce((select sum(sent)    from outreach_metrics_daily m where m.campaign_id = c.id and m.metric_date >= date_trunc('week', now())::date), 0)::int as sent_week,
    coalesce((select sum(replied) from outreach_metrics_daily m where m.campaign_id = c.id and m.metric_date >= date_trunc('week', now())::date), 0)::int as replied_week,
    coalesce((select sum(positive_replies) from outreach_metrics_daily m where m.campaign_id = c.id and m.metric_date >= date_trunc('week', now())::date), 0)::int as positive_week
from outreach_campaigns c
order by c.status, c.name;

create or replace view v_outreach_weekly as
select
    extract(week from metric_date)::int as week,
    sum(sent)::int as sent,
    sum(replied)::int as replied
from outreach_metrics_daily
where metric_date >= now() - interval '8 weeks'
group by 1
order by 1;

-- ============ Recruiting ============
create or replace view v_recruiting_kpis as
with apps as (
    select
        count(*) filter (where applied_at >= date_trunc('month', now()))::int as new_apps_month,
        count(*) filter (where stage in ('screening','interview','trial','offer'))::int as in_process,
        count(*) filter (where hired_at >= date_trunc('month', now()))::int as hired_month,
        count(*) filter (where rejected_at >= date_trunc('month', now()))::int as rejected_month,
        count(*) filter (where interviewed_at is not null and interviewed_at >= date_trunc('month', now()))::int as interviews_month,
        count(*) filter (where trial_started_at is not null and trial_started_at >= date_trunc('month', now()))::int as trials_month
    from recruiting_applications
), costs as (
    select
        coalesce(sum(amount), 0)::numeric as total_month,
        coalesce(sum(amount) filter (where category = 'trial_day'), 0)::numeric as trial_cost_month,
        coalesce(sum(amount) filter (where category = 'interview'), 0)::numeric as interview_cost_month,
        coalesce(sum(amount) filter (where category = 'ad_spend'), 0)::numeric as ad_spend_month
    from recruiting_costs
    where incurred_at >= date_trunc('month', now())::date
), positions as (
    select count(*) filter (where status = 'open')::int as open_positions
    from recruiting_positions
)
select
    p.open_positions,
    a.new_apps_month,
    a.in_process,
    a.interviews_month,
    a.trials_month,
    a.hired_month,
    a.rejected_month,
    c.total_month as spend_month,
    c.trial_cost_month,
    c.interview_cost_month,
    c.ad_spend_month,
    case when a.trials_month > 0 then round(c.trial_cost_month / a.trials_month, 2) else null end as avg_cost_per_trial,
    case when a.hired_month > 0 then round(c.total_month / a.hired_month, 2) else null end as cost_per_hire
from positions p, apps a, costs c;

create or replace view v_recruiting_funnel as
select 'Bewerbungen' as stage, count(*)::int as count, 1 as ord from recruiting_applications where applied_at >= date_trunc('month', now())
union all
select 'Screening',  count(*)::int, 2 from recruiting_applications where screened_at    is not null and screened_at    >= date_trunc('month', now())
union all
select 'Interview',  count(*)::int, 3 from recruiting_applications where interviewed_at is not null and interviewed_at >= date_trunc('month', now())
union all
select 'Probetag',   count(*)::int, 4 from recruiting_applications where trial_started_at is not null and trial_started_at >= date_trunc('month', now())
union all
select 'Angebot',    count(*)::int, 5 from recruiting_applications where offered_at     is not null and offered_at     >= date_trunc('month', now())
union all
select 'Eingestellt',count(*)::int, 6 from recruiting_applications where hired_at       is not null and hired_at       >= date_trunc('month', now())
order by ord;

create or replace view v_recruiting_positions as
select
    p.id,
    p.title,
    p.department,
    p.status,
    p.opened_at,
    p.target_hire_date,
    p.budget_gross,
    coalesce((select count(*) from recruiting_applications a where a.position_id = p.id), 0)::int as applications,
    coalesce((select count(*) from recruiting_applications a where a.position_id = p.id and a.stage = 'interview'), 0)::int as in_interview,
    coalesce((select count(*) from recruiting_applications a where a.position_id = p.id and a.stage = 'trial'), 0)::int as in_trial,
    coalesce((select count(*) from recruiting_applications a where a.position_id = p.id and a.hired_at is not null), 0)::int as hired,
    coalesce((select sum(amount) from recruiting_costs c where c.position_id = p.id), 0)::numeric as spent
from recruiting_positions p
order by p.status, p.opened_at desc;

create or replace view v_recruiting_applications_recent as
select
    a.id,
    a.candidate_name,
    a.email,
    a.source,
    a.stage,
    a.applied_at,
    p.title as position_title,
    coalesce((select sum(amount) from recruiting_costs c where c.application_id = a.id), 0)::numeric as cost_so_far
from recruiting_applications a
left join recruiting_positions p on p.id = a.position_id
order by a.applied_at desc
limit 30;

create or replace view v_recruiting_cost_breakdown as
select
    category,
    sum(amount)::numeric as total,
    count(*)::int as entries
from recruiting_costs
where incurred_at >= date_trunc('month', now())::date
group by category
order by total desc;

-- ============ Finance: Inflows/Outflows (Qonto + Commerzbank combined) ============
create or replace view v_cashflow_kpis as
with tx as (
    select
        institution,
        sum(amount) filter (where amount > 0) as inflow,
        sum(amount) filter (where amount < 0) as outflow
    from bank_transactions
    where tx_date >= date_trunc('month', now())::date
    group by institution
)
select
    coalesce(sum(inflow), 0)::numeric as inflow_month,
    coalesce(sum(-outflow), 0)::numeric as outflow_month,
    coalesce(sum(inflow) + sum(outflow), 0)::numeric as net_month,
    coalesce((select jsonb_object_agg(institution, jsonb_build_object('in', inflow, 'out', -outflow)) from tx), '{}'::jsonb) as by_bank
from tx;

create or replace view v_inflows_recent as
select
    id,
    institution,
    tx_date,
    amount,
    label,
    counterparty,
    category
from bank_transactions
where amount > 0
order by tx_date desc
limit 30;

create or replace view v_outflows_recent as
select
    id,
    institution,
    tx_date,
    amount,
    label,
    counterparty,
    category
from bank_transactions
where amount < 0
order by tx_date desc
limit 30;

-- ============ Close CRM: status drill-down ============
create or replace view v_leads_by_status as
select
    coalesce(status, 'Unbekannt') as status,
    count(*)::int as count
from leads
group by 1
order by 2 desc;

create or replace view v_sales_by_owner_week as
select
    coalesce(user_name, '—') as owner,
    count(*) filter (where type = 'call')::int as anwahlen,
    count(*) filter (where type = 'call' and outcome = 'connected')::int as cc,
    case when count(*) filter (where type = 'call') > 0
         then round(100.0 * count(*) filter (where type = 'call' and outcome = 'connected')
                        / count(*) filter (where type = 'call'), 0)
         else 0 end as cc_pct
from activities
where occurred_at >= date_trunc('week', now())
group by 1
order by anwahlen desc;

create or replace view v_pipeline_by_source as
select
    coalesce(l.source, 'Unbekannt') as source,
    count(o.id)::int as deals,
    coalesce(sum(o.value), 0)::numeric as value
from opportunities o
left join leads l on l.id = o.lead_id
where o.status = 'active'
group by 1
order by value desc;

-- ============ Extended Overview (replaces earlier v_overview_kpis) ============
create or replace view v_overview_kpis as
select
    (select revenue_mtd from v_finance_kpis)                              as "revenueMTD",
    15000::numeric                                                         as "revenueTarget",
    coalesce((select sum(value) from opportunities where status='active'), 0)::numeric as "pipelineValue",
    coalesce((select count(*)   from opportunities where status='active'), 0)::int     as "pipelineCount",
    coalesce((select sum(balance) from bank_accounts), 0)::numeric        as "bankBalance",
    (select unpaid_total from v_finance_kpis)                              as "unpaidInvoices",
    (select unpaid_count from v_finance_kpis)                              as "unpaidInvoicesCount",
    coalesce((select sum(spend) from ad_metrics_daily where metric_date = current_date), 0)::numeric as "adSpendToday",
    (select open_tasks from v_team_kpis)                                   as "fulfillmentOpen",
    (select active_clients from v_coaching_kpis)                           as "coachingActive",
    (select submissions_week from v_coaching_kpis)                         as "coachingSubmissionsWeek",
    coalesce(
        (select sum(reach) from social_metrics_daily where metric_date >= date_trunc('week', now())::date),
        0
    )::int                                                                 as "socialReachWeek",
    (select sent_week  from v_outreach_kpis)                               as "outreachSentWeek",
    (select reply_rate from v_outreach_kpis)                               as "outreachReplyRate",
    (select in_process   from v_recruiting_kpis)                           as "recruitingInProcess",
    (select hired_month  from v_recruiting_kpis)                           as "recruitingHiredMonth",
    to_char(
        (select max(finished_at) from sync_runs where status = 'success'),
        'DD.MM.YYYY HH24:MI'
    )                                                                      as "lastSync";

-- ==== 20260417000007_sales_roles_marketing.sql ====
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

-- ==== 20260417000008_marketing_views.sql ====
-- =============================================================
-- Marketing views for Perspective / OnePage / CopeCart
-- =============================================================

create or replace view v_lp_kpis as
with week as (
    select
        platform,
        sum(views)::int           as views,
        sum(unique_visitors)::int as visitors,
        sum(opt_ins)::int         as leads
    from lp_metrics_daily
    where metric_date >= date_trunc('week', now())::date
    group by platform
)
select
    coalesce((select views    from week where platform = 'perspective'), 0)::int as perspective_views,
    coalesce((select visitors from week where platform = 'perspective'), 0)::int as perspective_visitors,
    coalesce((select leads    from week where platform = 'perspective'), 0)::int as perspective_leads,
    coalesce((select views    from week where platform = 'onepage'), 0)::int     as onepage_views,
    coalesce((select visitors from week where platform = 'onepage'), 0)::int     as onepage_visitors,
    coalesce((select leads    from week where platform = 'onepage'), 0)::int     as onepage_leads,
    case when coalesce((select visitors from week where platform = 'perspective'), 0) > 0
         then round(100.0 * (select leads from week where platform='perspective')
                          / (select visitors from week where platform='perspective'), 2)
         else 0 end as perspective_cvr,
    case when coalesce((select visitors from week where platform = 'onepage'), 0) > 0
         then round(100.0 * (select leads from week where platform='onepage')
                          / (select visitors from week where platform='onepage'), 2)
         else 0 end as onepage_cvr;

create or replace view v_lp_pages as
select
    p.id,
    p.platform,
    p.name,
    p.url,
    p.status,
    coalesce(sum(m.views) filter (where m.metric_date >= date_trunc('week', now())::date), 0)::int as views_week,
    coalesce(sum(m.opt_ins) filter (where m.metric_date >= date_trunc('week', now())::date), 0)::int as leads_week,
    coalesce(sum(m.opt_ins) filter (where m.metric_date >= date_trunc('month', now())::date), 0)::int as leads_month
from landing_pages p
left join lp_metrics_daily m on m.page_id = p.id
group by p.id, p.platform, p.name, p.url, p.status
order by leads_week desc;

create or replace view v_copecart_kpis as
select
    coalesce(sum(amount) filter (where status='paid' and sold_at >= date_trunc('month', now())), 0)::numeric as revenue_month,
    coalesce(count(*)    filter (where status='paid' and sold_at >= date_trunc('month', now())), 0)::int     as sales_month,
    coalesce(sum(amount) filter (where status='paid' and sold_at >= date_trunc('week',  now())), 0)::numeric as revenue_week,
    coalesce(count(*)    filter (where status='paid' and sold_at >= date_trunc('week',  now())), 0)::int     as sales_week,
    coalesce(count(*)    filter (where status='refunded' and sold_at >= date_trunc('month', now())), 0)::int as refunds_month
from copecart_sales;

create or replace view v_copecart_products as
select
    p.id,
    p.name,
    p.price_gross,
    coalesce(count(s.id) filter (where s.status='paid' and s.sold_at >= date_trunc('month', now())), 0)::int     as sales_month,
    coalesce(sum(s.amount) filter (where s.status='paid' and s.sold_at >= date_trunc('month', now())), 0)::numeric as revenue_month
from copecart_products p
left join copecart_sales s on s.product_id = p.id
group by p.id, p.name, p.price_gross
order by revenue_month desc;

-- ==== 20260417000009_airtable.sql ====
-- =============================================================
-- Airtable integration — bi-directional sync
--
-- Pattern:
-- - `airtable_sync_config` defines what to sync. Each row is one
--   Airtable table mapped to one Supabase target/source.
-- - For PULL: raw records land in `airtable_records` (generic staging)
--   OR in a specific target table (e.g. `manual_expenses`) via
--   field_mapping.
-- - For PUSH: the Edge Function reads the Supabase source table and
--   upserts into Airtable by `airtable_record_id` (stored back on
--   the source row).
-- =============================================================

create table if not exists airtable_sync_config (
    id uuid primary key default gen_random_uuid(),
    direction text not null,                   -- 'pull' | 'push'
    base_id text not null,                     -- 'appXXXXXXXX'
    table_name text not null,                  -- Airtable table display name
    view_name text,                            -- optional Airtable view filter
    topic text not null,                       -- logical grouping: 'manual_expense','manual_kpi','leads_mirror',...
    supabase_table text,                       -- optional: typed target/source
    field_mapping jsonb default '{}'::jsonb,   -- { "AirtableField": "supabase_column" }
    active boolean default true,
    last_synced_at timestamptz,
    last_cursor text,                          -- Airtable offset or last ID
    created_at timestamptz not null default now()
);
create index if not exists idx_atsc_topic on airtable_sync_config (topic);

-- Generic staging: everything pulled lands here with the raw record.
-- Typed target tables can mirror from this via triggers or scheduled
-- functions.
create table if not exists airtable_records (
    id text primary key,                       -- Airtable record id (rec...)
    base_id text not null,
    table_name text not null,
    topic text not null,
    fields jsonb not null,
    created_time timestamptz,
    synced_at timestamptz not null default now()
);
create index if not exists idx_atr_topic on airtable_records (topic);
create index if not exists idx_atr_table on airtable_records (base_id, table_name);

-- Typed convenience tables for common manual inputs
create table if not exists manual_expenses (
    id uuid primary key default gen_random_uuid(),
    airtable_record_id text unique,
    category text not null,                    -- e.g. 'tool','office','event','travel'
    vendor text,
    description text,
    amount numeric(12,2) not null,
    currency text default 'EUR',
    incurred_at date default current_date,
    notes text,
    source text default 'manual',              -- 'manual','airtable','csv'
    created_at timestamptz not null default now()
);
create index if not exists idx_manual_expenses_date on manual_expenses (incurred_at desc);
create index if not exists idx_manual_expenses_category on manual_expenses (category);

create table if not exists manual_income (
    id uuid primary key default gen_random_uuid(),
    airtable_record_id text unique,
    source text,                               -- coaching client, cash sale, etc.
    description text,
    amount numeric(12,2) not null,
    currency text default 'EUR',
    received_at date default current_date,
    origin text default 'manual',
    created_at timestamptz not null default now()
);
create index if not exists idx_manual_income_date on manual_income (received_at desc);

-- Catch-all for arbitrary KPIs the user tracks in Airtable
-- (e.g. weekly physical event attendance, survey scores, etc.)
create table if not exists manual_kpis (
    id uuid primary key default gen_random_uuid(),
    airtable_record_id text unique,
    topic text not null,                       -- e.g. 'event_attendance'
    metric text not null,                      -- e.g. 'participants'
    value numeric,
    label text,
    measured_at date default current_date,
    meta jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists idx_manual_kpis_topic on manual_kpis (topic, measured_at desc);

-- Add airtable_record_id to existing tables that might be mirrored
alter table leads                    add column if not exists airtable_record_id text unique;
alter table opportunities            add column if not exists airtable_record_id text unique;
alter table coaching_clients         add column if not exists airtable_record_id text unique;
alter table client_submissions       add column if not exists airtable_record_id text unique;
alter table recruiting_applications  add column if not exists airtable_record_id text unique;
alter table recruiting_costs         add column if not exists airtable_record_id text unique;
alter table invoices                 add column if not exists airtable_record_id text unique;

-- =============================================================
-- Views
-- =============================================================
create or replace view v_airtable_status as
select
    topic,
    direction,
    base_id,
    table_name,
    supabase_table,
    active,
    last_synced_at,
    (select count(*) from airtable_records r
      where r.topic = c.topic) as records_count
from airtable_sync_config c
order by direction, topic;

create or replace view v_manual_finance_kpis as
select
    coalesce(sum(amount) filter (where incurred_at >= date_trunc('month', now())::date), 0)::numeric as expenses_month,
    coalesce(sum(amount) filter (where incurred_at >= date_trunc('week',  now())::date), 0)::numeric as expenses_week,
    (select coalesce(sum(amount) filter (where received_at >= date_trunc('month', now())::date), 0)::numeric from manual_income) as income_month,
    (select coalesce(sum(amount) filter (where received_at >= date_trunc('week',  now())::date), 0)::numeric from manual_income) as income_week
from manual_expenses;

create or replace view v_manual_expenses_by_category as
select
    category,
    count(*)::int as entries,
    coalesce(sum(amount), 0)::numeric as total
from manual_expenses
where incurred_at >= date_trunc('month', now())::date
group by category
order by total desc;

-- =============================================================
-- RLS
-- =============================================================
alter table airtable_sync_config enable row level security;
alter table airtable_records     enable row level security;
alter table manual_expenses      enable row level security;
alter table manual_income        enable row level security;
alter table manual_kpis          enable row level security;

do $$
declare t text;
begin
    for t in
        select unnest(array[
            'airtable_sync_config','airtable_records',
            'manual_expenses','manual_income','manual_kpis'
        ])
    loop
        execute format('drop policy if exists "read_auth"  on %I', t);
        execute format('create policy "read_auth"  on %I for select to authenticated using (true)', t);
        execute format('drop policy if exists "write_auth" on %I', t);
        execute format('create policy "write_auth" on %I for all   to authenticated using (true) with check (true)', t);
    end loop;
end$$;

-- =============================================================
-- Sensible default config rows (inactive until you set the real
-- base_id and table names, then toggle `active = true`).
-- =============================================================
insert into airtable_sync_config (direction, base_id, table_name, topic, supabase_table, active, field_mapping) values
  -- PULL: manual data that's easier to enter in Airtable
  ('pull', 'appREPLACEME', 'Ausgaben',        'manual_expense', 'manual_expenses', false,
   '{"Kategorie":"category","Anbieter":"vendor","Beschreibung":"description","Betrag":"amount","Datum":"incurred_at","Notizen":"notes"}'::jsonb),
  ('pull', 'appREPLACEME', 'Einnahmen',       'manual_income',  'manual_income',   false,
   '{"Quelle":"source","Beschreibung":"description","Betrag":"amount","Datum":"received_at"}'::jsonb),
  ('pull', 'appREPLACEME', 'Manuelle KPIs',   'manual_kpi',     'manual_kpis',     false,
   '{"Topic":"topic","Metrik":"metric","Wert":"value","Label":"label","Datum":"measured_at"}'::jsonb),
  -- PUSH: mirror core tables for human review / edit
  ('push', 'appREPLACEME', 'Leads',           'leads_mirror',           'leads',                   false, '{}'::jsonb),
  ('push', 'appREPLACEME', 'Deals',           'opportunities_mirror',   'opportunities',           false, '{}'::jsonb),
  ('push', 'appREPLACEME', 'Bewerbungen',     'applications_mirror',    'recruiting_applications', false, '{}'::jsonb),
  ('push', 'appREPLACEME', 'Coaching-Weeks',  'submissions_mirror',     'client_submissions',      false, '{}'::jsonb)
on conflict do nothing;

-- ==== 20260417000010_clients_profitability.sql ====
-- =============================================================
-- Client profitability: contracts, deliverables, time tracking,
-- delivery costs, ROI per client.
--
-- Designed to be Finanzamt-kompatibel:
-- - Alle Buchungen haben Datum + Kategorie + Beschreibung
-- - Pro Kunde saubere Trennung für USt-Ausweis
-- - Zeit-Einträge mit Mitarbeiter + Stundensatz
-- =============================================================

-- =============================================================
-- Clients (Agentur-Kunden, Social Media Verwaltung etc.)
-- separat von `coaching_clients`.
-- =============================================================
create table if not exists clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    company text,
    industry text,
    status text default 'active',              -- 'active','paused','churned'
    onboarded_at date default current_date,
    churn_date date,
    account_manager text,                      -- z.B. 'Felix', 'Nils'
    notes text,
    airtable_record_id text unique,
    created_at timestamptz not null default now()
);
create index if not exists idx_clients_status on clients (status);

-- =============================================================
-- Contracts (monatliche Retainer, Projektverträge, etc.)
-- =============================================================
create table if not exists contracts (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients (id) on delete cascade,
    name text not null,                        -- "Social Media Full-Service"
    type text not null default 'retainer',     -- 'retainer','project','one_off'
    monthly_value numeric(12, 2),              -- netto pro Monat (retainer)
    total_value numeric(12, 2),                -- für Projekte
    hours_included int,                        -- inklusive Stunden / Monat
    hourly_rate numeric(8, 2),                 -- Zusatz-Stunden-Satz
    posts_per_month int,                       -- z.B. 12 Posts / Monat
    currency text default 'EUR',
    starts_on date not null,
    ends_on date,
    active boolean default true,
    created_at timestamptz not null default now()
);
create index if not exists idx_contracts_client on contracts (client_id);

-- =============================================================
-- Deliverables (Posts, Reels, Stories, Blogs — was wir pro Kunde liefern)
-- =============================================================
create table if not exists deliverables (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients (id) on delete cascade,
    contract_id uuid references contracts (id) on delete set null,
    type text not null,                        -- 'post','reel','story','blog','video','email'
    title text,
    status text default 'planned',             -- 'planned','in_progress','review','published','archived'
    planned_for date,
    published_at timestamptz,
    channel text,                              -- 'instagram','linkedin','tiktok','email','blog'
    url text,
    airtable_record_id text unique,
    created_at timestamptz not null default now()
);
create index if not exists idx_deliv_client on deliverables (client_id);
create index if not exists idx_deliv_status on deliverables (status);

-- =============================================================
-- Team members (Mitarbeiter) with hourly cost
-- =============================================================
create table if not exists team_members (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,                 -- 'Nils', 'Lisa', 'Felix'
    email text,
    role text,                                 -- 'video','design','ads','lead','va'
    hourly_cost numeric(8, 2) not null default 0,  -- was uns der Mitarbeiter pro Std. kostet (brutto)
    active boolean default true,
    created_at timestamptz not null default now()
);

-- =============================================================
-- Time entries (Clockify / manuell / Airtable)
-- =============================================================
create table if not exists time_entries (
    id text primary key,                       -- Clockify entry id, or uuid-as-text
    client_id uuid references clients (id) on delete set null,
    deliverable_id uuid references deliverables (id) on delete set null,
    member_id uuid references team_members (id) on delete set null,
    member_name text,                          -- fallback if member not mapped
    description text,
    started_at timestamptz not null,
    ended_at timestamptz,
    duration_seconds int,
    billable boolean default true,
    hourly_rate numeric(8, 2),                 -- Verkaufssatz zur Zeit der Buchung
    hourly_cost numeric(8, 2),                 -- Kostensatz zur Zeit der Buchung
    source text default 'manual',              -- 'clockify','manual','airtable'
    synced_at timestamptz not null default now()
);
create index if not exists idx_time_entries_client on time_entries (client_id, started_at desc);
create index if not exists idx_time_entries_member on time_entries (member_id, started_at desc);
create index if not exists idx_time_entries_date on time_entries (started_at desc);

-- =============================================================
-- Delivery costs (Kosten, die direkt einem Kunden zuordenbar sind:
-- Nils-Filming, Requisiten, Paid Ads mit Kundenkonto, etc.)
-- =============================================================
create table if not exists delivery_costs (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references clients (id) on delete cascade,
    deliverable_id uuid references deliverables (id) on delete set null,
    category text not null,                    -- 'filming','material','ad_spend','travel','external','software'
    description text,
    amount numeric(12, 2) not null,
    currency text default 'EUR',
    incurred_at date default current_date,
    invoice_number text,                       -- für Steuerbeleg
    source text default 'manual',              -- 'manual','airtable','easybill'
    airtable_record_id text unique,
    created_at timestamptz not null default now()
);
create index if not exists idx_delivery_costs_client on delivery_costs (client_id, incurred_at desc);
create index if not exists idx_delivery_costs_category on delivery_costs (category);

-- =============================================================
-- RLS
-- =============================================================
alter table clients        enable row level security;
alter table contracts      enable row level security;
alter table deliverables   enable row level security;
alter table team_members   enable row level security;
alter table time_entries   enable row level security;
alter table delivery_costs enable row level security;

do $$
declare t text;
begin
    for t in
        select unnest(array[
            'clients','contracts','deliverables','team_members',
            'time_entries','delivery_costs'
        ])
    loop
        execute format('drop policy if exists "read_auth"  on %I', t);
        execute format('create policy "read_auth"  on %I for select to authenticated using (true)', t);
        execute format('drop policy if exists "write_auth" on %I', t);
        execute format('create policy "write_auth" on %I for all   to authenticated using (true) with check (true)', t);
    end loop;
end$$;

-- ==== 20260417000011_clients_views.sql ====
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

-- ==== 20260417000012_tax.sql ====
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

-- ==== 20260417000013_automation.sql ====
-- =============================================================
-- Automation: bank↔invoice matching, client health, hours warnings,
-- forecast, daily digest snapshot
-- =============================================================

-- =============================================================
-- AUTO-MATCH bank_transactions → invoices
-- Matches positive bank transactions to unpaid invoices by
-- amount + customer name fuzzy match within ±7 days.
-- =============================================================
create or replace function auto_match_bank_to_invoice() returns trigger as $$
declare
    matched_invoice_id text;
begin
    if new.amount <= 0 then
        return new;
    end if;

    -- Find unpaid invoice with matching amount (±0.02 €) whose customer
    -- name appears in the transaction counterparty or label
    select i.id into matched_invoice_id
    from invoices i
    where i.status in ('open', 'overdue')
      and abs(i.total - new.amount) < 0.02
      and (
            (new.counterparty is not null and i.customer_name is not null
                and (new.counterparty ilike '%' || split_part(i.customer_name, ' ', 1) || '%'))
         or (new.label is not null and i.customer_name is not null
                and (new.label ilike '%' || split_part(i.customer_name, ' ', 1) || '%'))
         or (i.due_date is not null and abs(new.tx_date - i.due_date) <= 7)
      )
    order by abs(coalesce(new.tx_date - i.due_date, 0)) asc
    limit 1;

    if matched_invoice_id is not null then
        update invoices
           set status = 'paid',
               paid_at = new.tx_date,
               synced_at = now()
         where id = matched_invoice_id;
    end if;

    return new;
end $$ language plpgsql;

drop trigger if exists trg_bank_auto_match on bank_transactions;
create trigger trg_bank_auto_match
    after insert or update on bank_transactions
    for each row execute function auto_match_bank_to_invoice();

-- =============================================================
-- CLIENT HEALTH SCORE
-- Combines: margin trend, hours trend, activity recency,
-- deliverable publication consistency.
-- 0–100, with badges: healthy / at_risk / critical.
-- =============================================================
create or replace view v_client_health as
with base as (
    select * from v_client_profitability
), last_activity as (
    select client_id, max(started_at) as last_time_entry
    from time_entries
    group by client_id
), posts_ratio as (
    select
        c.id as client_id,
        coalesce((select posts_per_month from contracts where client_id = c.id and active order by created_at desc limit 1), 0) as posts_target,
        coalesce((select count(*) from deliverables d where d.client_id = c.id and d.status = 'published'
                     and d.published_at >= date_trunc('month', now())), 0) as posts_done
    from clients c
), last_month_margin as (
    -- Simplified: approximation using last month labor cost if available
    select
        c.id as client_id,
        coalesce((select sum(duration_seconds * coalesce(hourly_cost, 0)) / 3600.0
                    from time_entries t
                   where t.client_id = c.id
                     and t.started_at >= date_trunc('month', now() - interval '1 month')
                     and t.started_at <  date_trunc('month', now())), 0)::numeric as labor_last_month
    from clients c
)
select
    b.id                                      as client_id,
    b.name,
    b.margin_pct,
    b.margin_month,
    b.hours_month,
    b.posts_published_month,
    p.posts_target,
    la.last_time_entry,
    greatest(0, coalesce(extract(day from (now() - la.last_time_entry))::int, 99)) as days_since_activity,
    -- Score components (each 0..25)
    least(25, greatest(0, coalesce(round(b.margin_pct / 2), 0)))                          as score_margin,
    case when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 3 then 25
         when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 7 then 20
         when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 14 then 10
         else 0 end                                                                        as score_recency,
    case when p.posts_target = 0 then 15
         when p.posts_done >= p.posts_target then 25
         else least(25, round(25.0 * p.posts_done / nullif(p.posts_target, 0))) end          as score_delivery,
    case when lmm.labor_last_month > 0
              and lmm.labor_last_month < b.labor_cost_month * 1.3
              and lmm.labor_last_month > b.labor_cost_month * 0.7 then 25
         when lmm.labor_last_month = 0 then 15
         else 10 end                                                                       as score_stability,
    -- Final score 0..100
    (
        least(25, greatest(0, coalesce(round(b.margin_pct / 2), 0)))
      + case when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 3 then 25
             when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 7 then 20
             when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 14 then 10
             else 0 end
      + case when p.posts_target = 0 then 15
             when p.posts_done >= p.posts_target then 25
             else least(25, round(25.0 * p.posts_done / nullif(p.posts_target, 0))) end
      + case when lmm.labor_last_month > 0
                  and lmm.labor_last_month < b.labor_cost_month * 1.3
                  and lmm.labor_last_month > b.labor_cost_month * 0.7 then 25
             when lmm.labor_last_month = 0 then 15
             else 10 end
    )::int as health_score,
    case
        when (
            least(25, greatest(0, coalesce(round(b.margin_pct / 2), 0)))
          + case when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 3 then 25
                 when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 7 then 20
                 when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 14 then 10
                 else 0 end
          + case when p.posts_target = 0 then 15
                 when p.posts_done >= p.posts_target then 25
                 else least(25, round(25.0 * p.posts_done / nullif(p.posts_target, 0))) end
          + case when lmm.labor_last_month > 0
                      and lmm.labor_last_month < b.labor_cost_month * 1.3
                      and lmm.labor_last_month > b.labor_cost_month * 0.7 then 25
                 when lmm.labor_last_month = 0 then 15
                 else 10 end
        ) >= 75 then 'healthy'
        when (
            least(25, greatest(0, coalesce(round(b.margin_pct / 2), 0)))
          + case when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 3 then 25
                 when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 7 then 20
                 when coalesce(extract(day from (now() - la.last_time_entry)), 30) < 14 then 10
                 else 0 end
          + case when p.posts_target = 0 then 15
                 when p.posts_done >= p.posts_target then 25
                 else least(25, round(25.0 * p.posts_done / nullif(p.posts_target, 0))) end
          + case when lmm.labor_last_month > 0
                      and lmm.labor_last_month < b.labor_cost_month * 1.3
                      and lmm.labor_last_month > b.labor_cost_month * 0.7 then 25
                 when lmm.labor_last_month = 0 then 15
                 else 10 end
        ) >= 50 then 'at_risk'
        else 'critical'
    end as health_status
from base b
left join last_activity la      on la.client_id  = b.id
left join posts_ratio p          on p.client_id   = b.id
left join last_month_margin lmm  on lmm.client_id = b.id;

-- =============================================================
-- HOURS WARNINGS
-- Per active contract: hours used this month vs hours_included.
-- =============================================================
create or replace view v_contract_hours_usage as
select
    ct.id                  as contract_id,
    ct.client_id,
    c.name                 as client_name,
    ct.name                as contract_name,
    ct.hours_included,
    coalesce(h.hours_month, 0)::numeric as hours_used,
    case when ct.hours_included > 0
         then round(100.0 * coalesce(h.hours_month, 0) / ct.hours_included, 1)
         else null end     as usage_pct,
    ct.hourly_rate         as overage_rate,
    case
        when ct.hours_included is null or ct.hours_included = 0 then 'unlimited'
        when coalesce(h.hours_month, 0) / ct.hours_included >= 1.0 then 'overage'
        when coalesce(h.hours_month, 0) / ct.hours_included >= 0.8 then 'warning'
        else 'ok'
    end as status,
    case when ct.hours_included > 0
           and coalesce(h.hours_month, 0) > ct.hours_included
           and ct.hourly_rate is not null
         then round((coalesce(h.hours_month, 0) - ct.hours_included) * ct.hourly_rate, 2)
         else 0 end as upsell_potential_month
from contracts ct
join clients c on c.id = ct.client_id
left join v_client_hours_month h on h.client_id = ct.client_id
where ct.active = true
order by usage_pct desc nulls last;

-- =============================================================
-- FORECAST: linear regression on historical buckets
-- =============================================================

-- Daily series for regression (last 60 days)
create or replace view v_revenue_series_daily as
select
    invoice_date as day,
    coalesce(sum(total), 0)::numeric as revenue
from invoices
where status = 'paid'
  and invoice_date >= (current_date - 60)
group by invoice_date
order by invoice_date;

-- Monthly MRR series (last 6 months, based on snapshot approximation)
create or replace view v_mrr_series_monthly as
with months as (
    select generate_series(date_trunc('month', now()) - interval '5 months',
                           date_trunc('month', now()),
                           interval '1 month')::date as month_start
)
select
    m.month_start,
    coalesce(sum(ct.monthly_value) filter (
        where ct.starts_on <= m.month_start
          and (ct.ends_on is null or ct.ends_on > m.month_start)
    ), 0)::numeric as mrr
from months m
left join contracts ct on ct.active and ct.type = 'retainer'
group by m.month_start
order by m.month_start;

-- Forecast endpoint view: linear regression + next 3 periods
create or replace view v_forecast_summary as
with revenue as (
    select
        regr_slope(revenue, extract(epoch from day) / 86400)      as slope_per_day,
        regr_intercept(revenue, extract(epoch from day) / 86400)  as intercept_day,
        avg(revenue)                                              as avg_daily,
        count(*)                                                  as n_days
    from v_revenue_series_daily
), mrr as (
    select
        regr_slope(mrr, extract(epoch from month_start) / 2629743)     as slope_per_month,
        regr_intercept(mrr, extract(epoch from month_start) / 2629743) as intercept_month,
        avg(mrr)                                                       as avg_mrr,
        (select mrr from v_mrr_series_monthly order by month_start desc limit 1) as current_mrr
    from v_mrr_series_monthly
)
select
    revenue.avg_daily,
    revenue.slope_per_day,
    (revenue.avg_daily * 30) as forecast_revenue_30d,
    (revenue.avg_daily * 90) as forecast_revenue_90d,
    mrr.current_mrr,
    mrr.slope_per_month,
    greatest(0, mrr.current_mrr + mrr.slope_per_month * 1) as forecast_mrr_1m,
    greatest(0, mrr.current_mrr + mrr.slope_per_month * 3) as forecast_mrr_3m,
    greatest(0, mrr.current_mrr + mrr.slope_per_month * 6) as forecast_mrr_6m,
    (select sum(value) from opportunities where status = 'active') as pipeline_value,
    (select count(*) from opportunities where status = 'active')   as pipeline_count,
    -- Weighted pipeline: assume stage-based win probability
    coalesce((select sum(value * case
        when lower(stage) like 'won%'     then 1.0
        when lower(stage) like 'angebot%' then 0.4
        when lower(stage) like 'closing%' then 0.35
        when lower(stage) like 'setting%' then 0.15
        else 0.05 end)
      from opportunities where status = 'active'), 0)::numeric as pipeline_weighted
from revenue, mrr;

-- Per-month MRR forecast time series (historical + next 6)
create or replace view v_forecast_mrr_timeseries as
with hist as (
    select month_start, mrr, false as forecast
    from v_mrr_series_monthly
), reg as (
    select regr_slope(mrr, extract(epoch from month_start) / 2629743) as slope,
           regr_intercept(mrr, extract(epoch from month_start) / 2629743) as intercept
    from v_mrr_series_monthly
), future as (
    select
        (date_trunc('month', now()) + (g || ' months')::interval)::date as month_start,
        greatest(0, reg.intercept + reg.slope * extract(epoch from (date_trunc('month', now()) + (g || ' months')::interval)) / 2629743)::numeric as mrr,
        true as forecast
    from generate_series(1, 6) g, reg
)
select month_start, mrr::numeric, forecast
from (
    select * from hist
    union all
    select * from future
) t
order by month_start;

-- =============================================================
-- DAILY DIGEST snapshot — consumed by send-daily-digest Edge Function
-- =============================================================
create or replace view v_daily_digest as
select
    (select mrr from v_mrr_series_monthly order by month_start desc limit 1)::numeric as mrr,
    (select total_mrr from v_clients_kpis) as mrr_from_clients,
    (select count(*) from opportunities where status='won' and won_at >= current_date - interval '1 day') as deals_won_24h,
    (select coalesce(sum(value), 0) from opportunities where status='won' and won_at >= current_date - interval '1 day') as deals_won_24h_value,
    (select count(*) from invoices where status = 'overdue') as invoices_overdue,
    (select coalesce(sum(total), 0) from invoices where status = 'overdue') as invoices_overdue_value,
    (select count(*) from sync_runs where status='error' and started_at >= current_date - interval '1 day') as sync_errors_24h,
    (select count(*) from v_contract_hours_usage where status='overage') as contracts_overage,
    (select count(*) from v_client_health where health_status='critical') as clients_critical,
    (select count(*) from recruiting_applications where applied_at >= current_date - interval '1 day') as new_applications_24h,
    (select count(*) from client_submissions where created_at >= current_date - interval '1 day') as coaching_submissions_24h,
    now() as generated_at;

-- ==== seed.sql ====
-- =============================================================
-- DEMO SEED DATA — nur für lokales Testen / Staging
-- Führe das manuell aus:
--   npx supabase db reset   (zieht migrations + seed.sql)
-- oder:
--   psql $DATABASE_URL -f supabase/seed.sql
-- In Produktion NICHT ausführen.
-- =============================================================

-- Team members
insert into team_members (id, name, email, role, hourly_cost) values
  (gen_random_uuid(), 'Felix',  'felix@contentleads.de',  'lead',   80),
  (gen_random_uuid(), 'Lisa',   'lisa@contentleads.de',   'va',     35),
  (gen_random_uuid(), 'Nils',   'nils@contentleads.de',   'video',  45)
on conflict (name) do nothing;

-- Clients
with ins as (
    insert into clients (name, status, account_manager, onboarded_at) values
        ('Walter GmbH',     'active', 'Felix', now()::date - 120),
        ('Müller Coaching', 'active', 'Felix', now()::date - 80),
        ('Berg & Tal',      'active', 'Nils',  now()::date - 60),
        ('Studio Neun',     'active', 'Nils',  now()::date - 30)
    on conflict do nothing
    returning id, name
)
insert into contracts (client_id, name, type, monthly_value, hours_included, hourly_rate, posts_per_month, starts_on)
select id, name || ' Retainer', 'retainer',
       case name
           when 'Walter GmbH'     then 2990
           when 'Müller Coaching' then 1490
           when 'Berg & Tal'      then 3990
           when 'Studio Neun'     then  990
       end,
       case name when 'Walter GmbH' then 30 when 'Berg & Tal' then 40 else 15 end,
       150,
       case name when 'Walter GmbH' then 12 when 'Berg & Tal' then 15 when 'Müller Coaching' then 8 else 4 end,
       now()::date - 60
from ins;

-- Time entries (spread over the last 20 days)
insert into time_entries (id, client_id, member_id, member_name, description, started_at, ended_at, duration_seconds, billable, hourly_cost, source)
select
    'seed-te-' || md5(c.name || m.name || g)::text,
    c.id, m.id, m.name,
    'Content production',
    now() - (g || ' days')::interval - (random() * 4 || ' hours')::interval,
    now() - (g || ' days')::interval,
    (1800 + floor(random() * 7200))::int,
    true, m.hourly_cost, 'manual'
from clients c
cross join team_members m
cross join generate_series(0, 19) g
where random() < 0.5
on conflict do nothing;

-- Delivery costs
insert into delivery_costs (client_id, category, description, amount, incurred_at)
select c.id, 'filming', 'Kamera-Tag', (150 + floor(random() * 300))::numeric, now()::date - (floor(random() * 25))::int
from clients c, generate_series(1, 3);

insert into delivery_costs (client_id, category, description, amount, incurred_at)
select c.id, 'ad_spend', 'Meta-Kampagne', (80 + floor(random() * 250))::numeric, now()::date - (floor(random() * 25))::int
from clients c, generate_series(1, 2);

-- Deliverables
insert into deliverables (client_id, type, title, status, channel, published_at)
select c.id,
       (array['post','reel','story','video'])[floor(random() * 4 + 1)],
       'Content #' || g,
       (array['published','published','published','in_progress','planned'])[floor(random() * 5 + 1)],
       (array['instagram','linkedin','tiktok'])[floor(random() * 3 + 1)],
       case when random() > 0.3 then now() - (floor(random() * 25) || ' days')::interval else null end
from clients c, generate_series(1, 8) g;

-- Invoices (mix paid / open / overdue)
insert into invoices (id, number, customer_name, total, net, vat, status, invoice_date, due_date, paid_at, currency)
values
  ('seed-1', 'RG-2026-001', 'Walter GmbH',     3500.00, 2941.18, 558.82, 'paid',    now()::date - 15, now()::date - 1,  now()::date - 2, 'EUR'),
  ('seed-2', 'RG-2026-002', 'Müller Coaching', 1772.10, 1489.16, 282.94, 'paid',    now()::date - 10, now()::date + 4,  now()::date - 3, 'EUR'),
  ('seed-3', 'RG-2026-003', 'Berg & Tal',      4748.10, 3990.00, 758.10, 'paid',    now()::date - 8,  now()::date + 6,  now()::date - 1, 'EUR'),
  ('seed-4', 'RG-2026-004', 'Studio Neun',     1178.10,  990.00, 188.10, 'open',    now()::date - 3,  now()::date + 11, null, 'EUR'),
  ('seed-5', 'RG-2026-005', 'Walter GmbH',     3500.00, 2941.18, 558.82, 'overdue', now()::date - 25, now()::date - 10, null, 'EUR')
on conflict (id) do nothing;

-- Bank accounts + transactions (Qonto + Commerzbank)
insert into bank_accounts (id, name, iban, balance, currency, institution, source) values
  ('seed-acc-qonto',  'Qonto Hauptkonto', 'DE89 3704 0044 0532 0130 00', 24850.50, 'EUR', 'qonto',       'api'),
  ('seed-acc-cobank', 'Commerzbank',      'DE27 1005 0000 0024 2908 33',  8120.33, 'EUR', 'commerzbank', 'csv')
on conflict (id) do nothing;

insert into bank_transactions (id, account_id, institution, amount, currency, label, counterparty, category, tx_date, settled_at, direction)
select
    'seed-tx-' || g,
    (array['seed-acc-qonto','seed-acc-cobank'])[floor(random() * 2 + 1)],
    (array['qonto','commerzbank'])[floor(random() * 2 + 1)],
    case when random() > 0.6 then (100 + floor(random() * 3500))::numeric
                              else -(50 + floor(random() * 800))::numeric end,
    'EUR',
    (array['Stripe Payout','Amazon','WeWork Miete','Adobe','Google Ads','Kunde Walter','Kunde Berg & Tal','Nils Freelance','Lohn Lisa'])[floor(random() * 9 + 1)],
    null, null,
    now()::date - (floor(random() * 30))::int,
    now() - (floor(random() * 30) || ' days')::interval,
    null
from generate_series(1, 40) g
on conflict do nothing;
update bank_transactions set direction = case when amount >= 0 then 'in' else 'out' end where direction is null;

-- Coaching clients + submissions
insert into coaching_clients (name, email, program, joined_at, active) values
  ('Alex Weber',  'alex@web.de',  'Kickstart 90',  now()::date - 45, true),
  ('Marie Koch',  'm@koch.de',    'Kickstart 90',  now()::date - 30, true),
  ('Tobi Becker', 'tobi@bec.de',  'Pro',           now()::date - 10, true)
on conflict do nothing;

insert into client_submissions (client_id, week_start, revenue, new_leads, booked_calls, closes, notes)
select id, date_trunc('week', now())::date, (500 + floor(random() * 3000))::numeric, floor(random()*20)::int, floor(random()*10)::int, floor(random()*3)::int, 'Seed'
from coaching_clients;

-- Recruiting positions + applications
with p as (
    insert into recruiting_positions (title, department, status, opened_at, budget_gross)
    values ('Video Producer', 'Creative', 'open', now()::date - 20, 55000),
           ('Social Media Manager', 'Marketing', 'open', now()::date - 5, 48000)
    on conflict do nothing
    returning id, title
)
insert into recruiting_applications (position_id, candidate_name, email, source, stage, applied_at, interviewed_at, trial_started_at, hired_at)
select p.id,
       (array['Paul M.','Sophie K.','Jonas B.','Emma F.','Luis H.','Clara T.'])[floor(random()*6+1)] || ' #' || g,
       'candidate' || g || '@example.com',
       (array['linkedin','referral','indeed'])[floor(random()*3+1)],
       (array['new','screening','interview','trial','offer','hired','rejected'])[floor(random()*7+1)],
       now() - ((floor(random()*20)+1) || ' days')::interval,
       case when random() > 0.5 then now() - ((floor(random()*15)) || ' days')::interval else null end,
       case when random() > 0.75 then now() - ((floor(random()*10)) || ' days')::interval else null end,
       case when random() > 0.9 then now() - ((floor(random()*5))  || ' days')::interval else null end
from p, generate_series(1, 4) g;

-- Recruiting costs
insert into recruiting_costs (position_id, category, description, amount, incurred_at)
select id, (array['interview','trial_day','ad_spend'])[floor(random()*3+1)],
       'Recruiting-Ausgabe',
       (50 + floor(random()*450))::numeric,
       now()::date - (floor(random()*25))::int
from recruiting_positions, generate_series(1, 5);

-- Manual expenses (Tools, Büro, etc.)
insert into manual_expenses (category, vendor, description, amount, incurred_at)
values
    ('tool', 'Adobe',      'Creative Cloud', 70.87, now()::date - 3),
    ('tool', 'ChatGPT',    'Team Plan',     119.00, now()::date - 8),
    ('office','IKEA',      'Büromaterial',  234.50, now()::date - 12),
    ('travel','Deutsche Bahn','Kundentermin BER', 89.90, now()::date - 15)
on conflict do nothing;

-- Manual income (sonstige)
insert into manual_income (source, description, amount, received_at)
values ('Workshop',   'Tagesworkshop Walter',     1200.00, now()::date - 5),
       ('Affiliate',  'CopeCart Auszahlung',       450.00, now()::date - 12)
on conflict do nothing;

-- Fulfillment items (Monday-like)
insert into monday_boards (board_id, name) values
  ('seed-board-1', 'Weekly Ops'),
  ('seed-board-2', 'Content Pipeline')
on conflict (board_id) do nothing;

insert into fulfillment_items (id, board_id, name, status, category, assignee, created_at, completed_at)
select
    'seed-fi-' || g,
    (array['seed-board-1','seed-board-2'])[floor(random()*2+1)],
    'Task #' || g,
    (array['open','in_progress','done','done','done'])[floor(random()*5+1)],
    (array['daily','weekly','monthly'])[floor(random()*3+1)],
    (array['Lisa','Nils','Felix'])[floor(random()*3+1)],
    now() - ((floor(random()*10)+1) || ' days')::interval,
    case when random() > 0.4 then now() - ((floor(random()*8)) || ' days')::interval else null end
from generate_series(1, 30) g;
update fulfillment_items set status = 'done' where completed_at is not null and status = 'open';

-- Opportunities + activities for Sales
insert into leads (id, name, source, status, owner) values
  ('seed-l-1', 'Potential Walter',  'linkedin', 'Qualified',         'Felix'),
  ('seed-l-2', 'Potential Müller',  'referral', 'Interested',        'Felix'),
  ('seed-l-3', 'Potential Berg',    'ads',      'Potential New Lead','John')
on conflict (id) do nothing;

insert into opportunities (id, lead_id, lead_name, pipeline, stage, value, owner, status, won_at, created_at)
values
  ('seed-op-1', 'seed-l-1', 'Potential Walter',  'Main', 'Setting - Terminiert', 3500, 'Felix', 'active', null,              now() - interval '4 days'),
  ('seed-op-2', 'seed-l-2', 'Potential Müller',  'Main', 'Closing - Terminiert', 1490, 'Felix', 'won',   now() - interval '2 days', now() - interval '10 days'),
  ('seed-op-3', 'seed-l-3', 'Potential Berg',    'Main', 'Angebot verschickt',   3990, 'John',  'active', null,              now() - interval '5 days')
on conflict (id) do nothing;

insert into activities (id, lead_id, type, direction, outcome, user_name, occurred_at, duration_seconds)
select 'seed-a-' || g,
       (array['seed-l-1','seed-l-2','seed-l-3'])[floor(random()*3+1)],
       'call',
       'outgoing',
       (array['connected','no_answer','voicemail'])[floor(random()*3+1)],
       (array['Felix','John'])[floor(random()*2+1)],
       now() - ((floor(random()*6)+1) || ' days')::interval,
       (60 + floor(random()*600))::int
from generate_series(1, 80) g;

-- Outreach (Instantly)
insert into outreach_campaigns (id, name, status, created_at) values
  ('seed-c-1', 'Q2 Agencies',  'active', now() - interval '30 days'),
  ('seed-c-2', 'Coaches 2026', 'active', now() - interval '60 days')
on conflict do nothing;

insert into outreach_metrics_daily (campaign_id, metric_date, sent, opened, replied, positive_replies, bounced)
select c.id, now()::date - g,
       (40 + floor(random()*70))::int,
       (20 + floor(random()*30))::int,
       floor(random()*5)::int,
       floor(random()*2)::int,
       floor(random()*2)::int
from outreach_campaigns c, generate_series(0, 20) g
on conflict do nothing;

-- Social / Marketing
insert into social_account_metrics_daily (platform, metric_date, followers, profile_views, reach, impressions)
select 'instagram', now()::date - g, 4200 + g, 80 + floor(random()*80)::int, 800 + floor(random()*1200)::int, 1000 + floor(random()*1500)::int
from generate_series(0, 6);

insert into social_account_metrics_daily (platform, metric_date, followers, profile_views, reach, impressions)
select 'linkedin',  now()::date - g, 1800 + g, 40 + floor(random()*60)::int, 500 + floor(random()*1000)::int,  700 + floor(random()*1300)::int
from generate_series(0, 6);
