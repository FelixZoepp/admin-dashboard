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
