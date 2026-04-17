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
