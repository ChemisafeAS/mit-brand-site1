create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

-- Kør disse to linjer én gang først med jeres egne værdier:
-- select vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
-- select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'publishable_key');

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'delete-old-salt-analysis-pdfs'
  ) then
    perform cron.unschedule('delete-old-salt-analysis-pdfs');
  end if;
end
$$;

select cron.schedule(
  'delete-old-salt-analysis-pdfs',
  '30 2 * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/delete-old-salt-analysis-pdfs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'
        ),
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'
        )
      ),
      body := '{"monthsOld": 12}'::jsonb
    ) as request_id;
  $$
);
