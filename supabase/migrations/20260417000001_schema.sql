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
