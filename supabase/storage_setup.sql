insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ski-invoices',
  'ski-invoices',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload ski invoices" on storage.objects;
create policy "Authenticated users can upload ski invoices"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ski-invoices');

drop policy if exists "Authenticated users can read ski invoices" on storage.objects;
create policy "Authenticated users can read ski invoices"
on storage.objects
for select
to authenticated
using (bucket_id = 'ski-invoices');

drop policy if exists "Authenticated users can delete ski invoices" on storage.objects;
create policy "Authenticated users can delete ski invoices"
on storage.objects
for delete
to authenticated
using (bucket_id = 'ski-invoices');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salt-analysis-pdfs',
  'salt-analysis-pdfs',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload salt analysis pdfs" on storage.objects;
create policy "Authenticated users can upload salt analysis pdfs"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'salt-analysis-pdfs');

drop policy if exists "Authenticated users can read salt analysis pdfs" on storage.objects;
create policy "Authenticated users can read salt analysis pdfs"
on storage.objects
for select
to authenticated
using (bucket_id = 'salt-analysis-pdfs');

drop policy if exists "Authenticated users can delete salt analysis pdfs" on storage.objects;
create policy "Authenticated users can delete salt analysis pdfs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'salt-analysis-pdfs');
