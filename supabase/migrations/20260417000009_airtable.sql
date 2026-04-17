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
