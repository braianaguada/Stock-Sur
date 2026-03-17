drop policy if exists "company_settings_insert_authenticated" on public.company_settings;
drop policy if exists "company_settings_update_authenticated" on public.company_settings;
drop policy if exists "company_settings_delete_authenticated" on public.company_settings;
drop policy if exists "company_settings_write_admin" on public.company_settings;

create policy "company_settings_write_admin"
on public.company_settings
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "branding_assets_authenticated_insert" on storage.objects;
drop policy if exists "branding_assets_authenticated_update" on storage.objects;
drop policy if exists "branding_assets_authenticated_delete" on storage.objects;

create policy "branding_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'branding-assets'
  and public.has_role(auth.uid(), 'admin')
);

create policy "branding_assets_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'branding-assets'
  and public.has_role(auth.uid(), 'admin')
)
with check (
  bucket_id = 'branding-assets'
  and public.has_role(auth.uid(), 'admin')
);

create policy "branding_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'branding-assets'
  and public.has_role(auth.uid(), 'admin')
);
