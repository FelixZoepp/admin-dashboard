-- Schedule the daily digest at 07:00 UTC
select cron.unschedule('daily-digest') where exists (
    select 1 from cron.job where jobname = 'daily-digest'
);

select cron.schedule(
    'daily-digest',
    '0 7 * * *',
    $$
    select net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-digest',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    );
    $$
);
