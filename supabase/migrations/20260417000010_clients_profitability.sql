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
