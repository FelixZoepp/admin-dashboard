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
