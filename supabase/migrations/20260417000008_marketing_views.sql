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
