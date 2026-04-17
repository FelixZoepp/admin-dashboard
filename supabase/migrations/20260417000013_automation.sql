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
