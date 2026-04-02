create extension if not exists pgcrypto;

create table if not exists public.salt_analyses (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  file_name text not null,
  report_number text,
  recipient text,
  delivery_note_number text,
  sample_type text,
  water_content text,
  sample_date text,
  analysis_date text,
  storage_path text,
  source_excerpt text,
  status text not null default 'tjek',
  parsed_field_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.salt_analyses
add column if not exists source_key text;

alter table public.salt_analyses
add column if not exists file_name text;

alter table public.salt_analyses
add column if not exists report_number text;

alter table public.salt_analyses
add column if not exists recipient text;

alter table public.salt_analyses
add column if not exists delivery_note_number text;

alter table public.salt_analyses
add column if not exists sample_type text;

alter table public.salt_analyses
add column if not exists water_content text;

alter table public.salt_analyses
add column if not exists sample_date text;

alter table public.salt_analyses
add column if not exists analysis_date text;

alter table public.salt_analyses
add column if not exists storage_path text;

alter table public.salt_analyses
add column if not exists source_excerpt text;

alter table public.salt_analyses
add column if not exists status text;

alter table public.salt_analyses
add column if not exists parsed_field_count integer;

alter table public.salt_analyses
add column if not exists created_at timestamptz;

alter table public.salt_analyses
add column if not exists updated_at timestamptz;

update public.salt_analyses
set
  source_key = coalesce(nullif(source_key, ''), lower('file:' || coalesce(file_name, id::text))),
  file_name = coalesce(file_name, 'analyse.pdf'),
  status = coalesce(status, 'tjek'),
  parsed_field_count = coalesce(parsed_field_count, 0),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

alter table public.salt_analyses
alter column source_key set not null;

alter table public.salt_analyses
alter column file_name set not null;

alter table public.salt_analyses
alter column status set not null;

alter table public.salt_analyses
alter column status set default 'tjek';

alter table public.salt_analyses
alter column parsed_field_count set not null;

alter table public.salt_analyses
alter column parsed_field_count set default 0;

alter table public.salt_analyses
alter column created_at set not null;

alter table public.salt_analyses
alter column created_at set default timezone('utc', now());

alter table public.salt_analyses
alter column updated_at set not null;

alter table public.salt_analyses
alter column updated_at set default timezone('utc', now());

alter table public.salt_analyses
drop constraint if exists salt_analyses_status_check;

alter table public.salt_analyses
add constraint salt_analyses_status_check
check (status in ('klar', 'tjek'));

create index if not exists salt_analyses_sample_date_idx
on public.salt_analyses(sample_date);

create index if not exists salt_analyses_report_number_idx
on public.salt_analyses(report_number);

create unique index if not exists salt_analyses_source_key_idx
on public.salt_analyses(source_key);

create or replace function public.set_salt_analyses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_salt_analyses_updated_at on public.salt_analyses;

create trigger set_salt_analyses_updated_at
before update on public.salt_analyses
for each row
execute function public.set_salt_analyses_updated_at();

alter table public.salt_analyses enable row level security;

drop policy if exists "Authenticated users can manage salt analyses" on public.salt_analyses;
create policy "Authenticated users can manage salt analyses"
on public.salt_analyses
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read salt analyses" on public.salt_analyses;
create policy "Authenticated users can read salt analyses"
on public.salt_analyses
for select
to authenticated
using (true);
