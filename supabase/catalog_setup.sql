create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  content_key text not null,
  value text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique(page, content_key)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  role text,
  phone text,
  email text,
  address text,
  notes text,
  category text not null default 'Andet',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.contacts
drop constraint if exists contacts_category_check;

alter table public.contacts
add constraint contacts_category_check
check (
  category in (
    'Intern',
    'Kunde',
    'Leverandør',
    'Transport',
    'Samarbejdspartner',
    'Andet'
  )
);

create index if not exists categories_sort_order_idx on public.categories(sort_order);
create index if not exists products_category_sort_order_idx on public.products(category_id, sort_order);

delete from public.products duplicate_products
using public.products kept_product
where duplicate_products.name = kept_product.name
  and duplicate_products.category_id = kept_product.category_id
  and duplicate_products.id > kept_product.id;

create unique index if not exists products_name_category_unique
on public.products(name, category_id);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_content enable row level security;
alter table public.contacts enable row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can manage categories" on public.categories;
create policy "Authenticated users can manage categories"
on public.categories
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can manage products" on public.products;
create policy "Authenticated users can manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
on public.site_content
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can manage site content" on public.site_content;
create policy "Authenticated users can manage site content"
on public.site_content
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage contacts" on public.contacts;
create policy "Authenticated users can manage contacts"
on public.contacts
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can read contacts" on public.contacts;
create policy "Authenticated users can read contacts"
on public.contacts
for select
to authenticated
using (true);

insert into public.categories (name, sort_order)
values
  ('Vejsalt', 1),
  ('Magnesiumklorid', 2),
  ('Produktionssalt', 3),
  ('Calciumchlorid', 4),
  ('Blødgøringssalt', 5),
  ('Fodersalt', 6),
  ('Konserveringssalt', 7)
on conflict (name) do update
set sort_order = excluded.sort_order;

insert into public.products (name, category_id, sort_order)
values
  ('Pingo vejsalt - 25 kg sæk', (select id from public.categories where name = 'Vejsalt'), 1),
  ('Pingo vejsalt - 15 kg sæk', (select id from public.categories where name = 'Vejsalt'), 2),
  ('Pingo vejsalt - 10 kg sæk', (select id from public.categories where name = 'Vejsalt'), 3),
  ('Pingo vejsalt - 10 kg spand', (select id from public.categories where name = 'Vejsalt'), 4),
  ('Pingo vejsalt - 1000 kg big bag', (select id from public.categories where name = 'Vejsalt'), 5),
  ('Pingo vejsalt - 600 kg big bag', (select id from public.categories where name = 'Vejsalt'), 6),
  ('Urea 46% - 15 kg sæk', (select id from public.categories where name = 'Vejsalt'), 7),
  ('Pingo Stensalt - Bulk', (select id from public.categories where name = 'Vejsalt'), 8),
  ('Pingo Havsalt - Bulk', (select id from public.categories where name = 'Vejsalt'), 9),
  ('Magnesium Chloride flakes - 25 kg sæk', (select id from public.categories where name = 'Magnesiumklorid'), 1),
  ('Pingo-Produktionssalt - 20 kg sæk', (select id from public.categories where name = 'Produktionssalt'), 1),
  ('Calcium Chloride flakes - 15 kg sæk', (select id from public.categories where name = 'Calciumchlorid'), 1),
  ('Calcium Cloride prills - 15 kg sæk', (select id from public.categories where name = 'Calciumchlorid'), 2),
  ('Salttabletter til blødgøringsanlæg - 10 kg sæk', (select id from public.categories where name = 'Blødgøringssalt'), 1),
  ('Salttabletter til blødgøringsanlæg - 25 kg sæk', (select id from public.categories where name = 'Blødgøringssalt'), 2),
  ('Fodersalt GMP+FSA sikret - Bulk', (select id from public.categories where name = 'Fodersalt'), 1),
  ('Fodersalt GMP+FSA sikret - 1000 kg big bag', (select id from public.categories where name = 'Fodersalt'), 2),
  ('Fodersalt GMP+FSA sikret - 25 kg sæk', (select id from public.categories where name = 'Fodersalt'), 3),
  ('Hudesalt 80/20 Mix - Bulk', (select id from public.categories where name = 'Konserveringssalt'), 1)
on conflict (name, category_id) do update
set sort_order = excluded.sort_order;
