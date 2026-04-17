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
