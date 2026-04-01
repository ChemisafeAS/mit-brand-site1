create extension if not exists pg_cron;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'archive-old-salt-analyses'
  ) then
    perform cron.unschedule('archive-old-salt-analyses');
  end if;
end
$$;

select cron.schedule(
  'archive-old-salt-analyses',
  '0 2 * * *',
  $$select public.archive_old_salt_analyses(12);$$
);
