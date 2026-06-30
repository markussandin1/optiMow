create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace <PROJECT_REF> with the Supabase project ref and <CRON_SECRET> with the configured secret.
select cron.schedule(
  'auto-retry-monitor',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/auto-retry-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
