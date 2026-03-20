alter table public.company_settings
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.company_settings
  drop constraint if exists company_settings_id_check;

create sequence if not exists public.company_settings_id_seq;

select setval(
  'public.company_settings_id_seq',
  greatest(coalesce((select max(id) from public.company_settings), 1), 1),
  true
);

alter table public.company_settings
  alter column id drop default;

alter table public.company_settings
  alter column id set default nextval('public.company_settings_id_seq');

do $$
declare
  v_company_id uuid;
begin
  select id
  into v_company_id
  from public.companies
  order by created_at
  limit 1;

  if v_company_id is null then
    raise exception 'No existe una empresa para vincular configuracion';
  end if;

  update public.company_settings
  set company_id = v_company_id
  where company_id is null;
end
$$;

alter table public.company_settings
  alter column company_id set not null;

create unique index if not exists company_settings_company_id_key
  on public.company_settings(company_id);

insert into public.company_settings (
  company_id,
  app_name,
  legal_name,
  tax_id,
  address,
  phone,
  whatsapp,
  email,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  document_tagline,
  document_footer,
  default_point_of_sale
)
select
  c.id,
  'Stock Sur',
  c.name,
  null,
  null,
  null,
  null,
  null,
  null,
  '#1f4f99',
  '#c62828',
  '#eef3fb',
  'Documentacion comercial',
  'Este documento no reemplaza comprobantes fiscales',
  1
from public.companies c
where not exists (
  select 1
  from public.company_settings cs
  where cs.company_id = c.id
);

drop policy if exists "company_settings_read_public" on public.company_settings;
drop policy if exists "company_settings_write_admin" on public.company_settings;

create policy "company_settings_read_company_member"
on public.company_settings
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'settings.view')
);

create policy "company_settings_write_company_admin"
on public.company_settings
for all
to authenticated
using (public.has_company_permission(auth.uid(), company_id, 'settings.manage'))
with check (public.has_company_permission(auth.uid(), company_id, 'settings.manage'));

drop policy if exists "branding_assets_admin_insert" on storage.objects;
drop policy if exists "branding_assets_admin_update" on storage.objects;
drop policy if exists "branding_assets_admin_delete" on storage.objects;

create policy "branding_assets_company_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'branding-assets'
  and public.has_company_permission(auth.uid(), split_part(name, '/', 1)::uuid, 'settings.manage')
);

create policy "branding_assets_company_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'branding-assets'
  and public.has_company_permission(auth.uid(), split_part(name, '/', 1)::uuid, 'settings.manage')
)
with check (
  bucket_id = 'branding-assets'
  and public.has_company_permission(auth.uid(), split_part(name, '/', 1)::uuid, 'settings.manage')
);

create policy "branding_assets_company_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'branding-assets'
  and public.has_company_permission(auth.uid(), split_part(name, '/', 1)::uuid, 'settings.manage')
);
