-- =============================================================
-- Scheduled syncs via pg_cron + pg_net
-- Runs every day at 06:00 UTC → triggers the `sync-all` Edge Function.
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the service role key + project URL as DB settings first:
--   alter database postgres set "app.settings.supabase_url"        to 'https://imdcuumthauvrfhghqtz.supabase.co';
--   alter database postgres set "app.settings.service_role_key"    to '<service-role-key>';
-- (Do this once via the Supabase SQL editor; NEVER commit the key.)

select cron.unschedule('daily-sync-all') where exists (
    select 1 from cron.job where jobname = 'daily-sync-all'
);

select cron.schedule(
    'daily-sync-all',
    '0 6 * * *',
    $$
    select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-all',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);
