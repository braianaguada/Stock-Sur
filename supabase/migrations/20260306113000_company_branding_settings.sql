create table if not exists public.company_settings (
  id integer primary key default 1 check (id = 1),
  app_name text not null default 'Stock Sur',
  legal_name text null,
  tax_id text null,
  address text null,
  phone text null,
  whatsapp text null,
  email text null,
  logo_url text null,
  primary_color text not null default '#1f4f99',
  secondary_color text not null default '#c62828',
  accent_color text not null default '#eef3fb',
  document_tagline text null default 'Documentacion comercial',
  document_footer text null default 'Este documento no reemplaza comprobantes fiscales',
  default_point_of_sale integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists update_company_settings_updated_at on public.company_settings;
create trigger update_company_settings_updated_at
before update on public.company_settings
for each row execute function public.update_updated_at_column();

alter table public.company_settings enable row level security;

drop policy if exists "company_settings_read_public" on public.company_settings;
create policy "company_settings_read_public"
on public.company_settings
for select
to anon, authenticated
using (true);

drop policy if exists "company_settings_write_admin" on public.company_settings;
create policy "company_settings_write_admin"
on public.company_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public)
values ('branding-assets', 'branding-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "branding_assets_public_read" on storage.objects;
create policy "branding_assets_public_read"
on storage.objects
for select
to public
using (bucket_id = 'branding-assets');

drop policy if exists "branding_assets_authenticated_insert" on storage.objects;
create policy "branding_assets_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'branding-assets');

drop policy if exists "branding_assets_authenticated_update" on storage.objects;
create policy "branding_assets_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'branding-assets')
with check (bucket_id = 'branding-assets');

drop policy if exists "branding_assets_authenticated_delete" on storage.objects;
create policy "branding_assets_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'branding-assets');
