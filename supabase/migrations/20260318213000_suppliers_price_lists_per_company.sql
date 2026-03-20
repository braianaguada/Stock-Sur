create table if not exists public.supplier_import_mappings (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  file_type text not null default 'xlsx',
  mapping jsonb not null,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_supplier_import_mappings_supplier_file_type
  on public.supplier_import_mappings (supplier_id, file_type);

alter table public.supplier_import_mappings enable row level security;

alter table public.suppliers
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.price_lists
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.price_list_versions
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.price_list_lines
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.price_list_items
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.supplier_documents
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.supplier_catalogs
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.supplier_catalog_versions
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.supplier_catalog_lines
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.supplier_import_mappings
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

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
    raise exception 'No existe una empresa para vincular proveedores y listas';
  end if;

  update public.suppliers
  set company_id = v_company_id
  where company_id is null;

  update public.price_lists pl
  set company_id = coalesce(s.company_id, v_company_id)
  from public.suppliers s
  where pl.supplier_id = s.id
    and pl.company_id is null;

  update public.price_lists
  set company_id = v_company_id
  where company_id is null;

  update public.price_list_versions plv
  set company_id = pl.company_id
  from public.price_lists pl
  where plv.price_list_id = pl.id
    and plv.company_id is null;

  update public.price_list_lines pll
  set company_id = plv.company_id
  from public.price_list_versions plv
  where pll.version_id = plv.id
    and pll.company_id is null;

  update public.price_list_items pli
  set company_id = pl.company_id
  from public.price_lists pl
  where pli.price_list_id = pl.id
    and pli.company_id is null;

  update public.supplier_documents sd
  set company_id = s.company_id
  from public.suppliers s
  where sd.supplier_id = s.id
    and sd.company_id is null;

  update public.supplier_catalogs sc
  set company_id = s.company_id
  from public.suppliers s
  where sc.supplier_id = s.id
    and sc.company_id is null;

  update public.supplier_catalog_versions scv
  set company_id = coalesce(
    (
      select sc.company_id
      from public.supplier_catalogs sc
      where sc.id = scv.catalog_id
    ),
    (
      select sd.company_id
      from public.supplier_documents sd
      where sd.id = scv.supplier_document_id
    ),
    v_company_id
  )
  where scv.company_id is null;

  update public.supplier_catalog_lines scl
  set company_id = scv.company_id
  from public.supplier_catalog_versions scv
  where scl.supplier_catalog_version_id = scv.id
    and scl.company_id is null;

  update public.supplier_import_mappings sim
  set company_id = s.company_id
  from public.suppliers s
  where sim.supplier_id = s.id
    and sim.company_id is null;
end
$$;

alter table public.suppliers alter column company_id set not null;
alter table public.price_lists alter column company_id set not null;
alter table public.price_list_versions alter column company_id set not null;
alter table public.price_list_lines alter column company_id set not null;
alter table public.price_list_items alter column company_id set not null;
alter table public.supplier_documents alter column company_id set not null;
alter table public.supplier_catalogs alter column company_id set not null;
alter table public.supplier_catalog_versions alter column company_id set not null;
alter table public.supplier_catalog_lines alter column company_id set not null;
alter table public.supplier_import_mappings alter column company_id set not null;

create index if not exists suppliers_company_name_idx
  on public.suppliers(company_id, name);

create index if not exists price_lists_company_name_idx
  on public.price_lists(company_id, name);

create index if not exists price_list_versions_company_price_list_idx
  on public.price_list_versions(company_id, price_list_id, version_date desc nulls last);

create index if not exists price_list_lines_company_version_idx
  on public.price_list_lines(company_id, version_id, created_at desc);

create index if not exists price_list_items_company_price_list_idx
  on public.price_list_items(company_id, price_list_id, is_active);

create index if not exists supplier_documents_company_supplier_idx
  on public.supplier_documents(company_id, supplier_id, uploaded_at desc);

create index if not exists supplier_catalogs_company_supplier_idx
  on public.supplier_catalogs(company_id, supplier_id, created_at desc);

create index if not exists supplier_catalog_versions_company_catalog_idx
  on public.supplier_catalog_versions(company_id, catalog_id, imported_at desc);

create index if not exists supplier_catalog_lines_company_version_idx
  on public.supplier_catalog_lines(company_id, supplier_catalog_version_id, row_index);

create index if not exists supplier_import_mappings_company_supplier_idx
  on public.supplier_import_mappings(company_id, supplier_id, file_type);

drop policy if exists "suppliers_read_authenticated" on public.suppliers;
drop policy if exists "suppliers_insert_owner_or_admin" on public.suppliers;
drop policy if exists "suppliers_update_owner_or_admin" on public.suppliers;
drop policy if exists "suppliers_delete_owner_or_admin" on public.suppliers;
drop policy if exists "price_lists_read_authenticated" on public.price_lists;
drop policy if exists "price_lists_insert_owner_or_admin" on public.price_lists;
drop policy if exists "price_lists_update_owner_or_admin" on public.price_lists;
drop policy if exists "price_lists_delete_owner_or_admin" on public.price_lists;
drop policy if exists "price_list_versions_read_authenticated" on public.price_list_versions;
drop policy if exists "price_list_versions_insert_owner_or_admin" on public.price_list_versions;
drop policy if exists "price_list_versions_update_owner_or_admin" on public.price_list_versions;
drop policy if exists "price_list_versions_delete_owner_or_admin" on public.price_list_versions;
drop policy if exists "price_list_lines_read_authenticated" on public.price_list_lines;
drop policy if exists "price_list_lines_insert_owner_or_admin" on public.price_list_lines;
drop policy if exists "price_list_lines_update_owner_or_admin" on public.price_list_lines;
drop policy if exists "price_list_lines_delete_owner_or_admin" on public.price_list_lines;
drop policy if exists "price_list_items_read_authenticated" on public.price_list_items;
drop policy if exists "price_list_items_insert_owner_or_admin" on public.price_list_items;
drop policy if exists "price_list_items_update_owner_or_admin" on public.price_list_items;
drop policy if exists "price_list_items_delete_owner_or_admin" on public.price_list_items;
drop policy if exists "supplier_documents_read_authenticated" on public.supplier_documents;
drop policy if exists "supplier_documents_insert_owner_or_admin" on public.supplier_documents;
drop policy if exists "supplier_documents_update_owner_or_admin" on public.supplier_documents;
drop policy if exists "supplier_documents_delete_owner_or_admin" on public.supplier_documents;
drop policy if exists "supplier_catalogs_read_authenticated" on public.supplier_catalogs;
drop policy if exists "supplier_catalogs_insert_owner_or_admin" on public.supplier_catalogs;
drop policy if exists "supplier_catalogs_update_owner_or_admin" on public.supplier_catalogs;
drop policy if exists "supplier_catalogs_delete_owner_or_admin" on public.supplier_catalogs;
drop policy if exists "supplier_catalog_versions_read_authenticated" on public.supplier_catalog_versions;
drop policy if exists "supplier_catalog_versions_insert_owner_or_admin" on public.supplier_catalog_versions;
drop policy if exists "supplier_catalog_versions_update_owner_or_admin" on public.supplier_catalog_versions;
drop policy if exists "supplier_catalog_versions_delete_owner_or_admin" on public.supplier_catalog_versions;
drop policy if exists "supplier_catalog_lines_read_authenticated" on public.supplier_catalog_lines;
drop policy if exists "supplier_catalog_lines_insert_owner_or_admin" on public.supplier_catalog_lines;
drop policy if exists "supplier_catalog_lines_update_owner_or_admin" on public.supplier_catalog_lines;
drop policy if exists "supplier_catalog_lines_delete_owner_or_admin" on public.supplier_catalog_lines;
drop policy if exists "supplier_import_mappings_select_owner_or_admin" on public.supplier_import_mappings;
drop policy if exists "supplier_import_mappings_insert_owner_or_admin" on public.supplier_import_mappings;
drop policy if exists "supplier_import_mappings_update_owner_or_admin" on public.supplier_import_mappings;
drop policy if exists "supplier_import_mappings_delete_owner_or_admin" on public.supplier_import_mappings;

create policy "suppliers_read_company_member"
on public.suppliers
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "suppliers_write_company_member"
on public.suppliers
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
);

create policy "price_lists_read_company_member"
on public.price_lists
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "price_lists_write_company_member"
on public.price_lists
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
  and (
    supplier_id is null
    or exists (
      select 1
      from public.suppliers s
      where s.id = supplier_id
        and s.company_id = price_lists.company_id
    )
  )
);

create policy "price_list_versions_read_company_member"
on public.price_list_versions
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "price_list_versions_write_company_member"
on public.price_list_versions
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
  and exists (
    select 1
    from public.price_lists pl
    where pl.id = price_list_id
      and pl.company_id = price_list_versions.company_id
  )
);

create policy "price_list_lines_read_company_member"
on public.price_list_lines
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "price_list_lines_write_company_member"
on public.price_list_lines
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
  and exists (
    select 1
    from public.price_list_versions plv
    where plv.id = version_id
      and plv.company_id = price_list_lines.company_id
  )
);

create policy "price_list_items_read_company_member"
on public.price_list_items
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "price_list_items_write_company_member"
on public.price_list_items
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
  and exists (
    select 1
    from public.price_lists pl
    where pl.id = price_list_id
      and pl.company_id = price_list_items.company_id
  )
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.company_id = price_list_items.company_id
  )
);

create policy "supplier_documents_read_company_member"
on public.supplier_documents
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "supplier_documents_write_company_member"
on public.supplier_documents
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
  and (
    supplier_id is null
    or exists (
      select 1
      from public.suppliers s
      where s.id = supplier_id
        and s.company_id = supplier_documents.company_id
    )
  )
);

create policy "supplier_catalogs_read_company_member"
on public.supplier_catalogs
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "supplier_catalogs_write_company_member"
on public.supplier_catalogs
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
  and exists (
    select 1
    from public.suppliers s
    where s.id = supplier_id
      and s.company_id = supplier_catalogs.company_id
  )
);

create policy "supplier_catalog_versions_read_company_member"
on public.supplier_catalog_versions
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "supplier_catalog_versions_write_company_member"
on public.supplier_catalog_versions
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
  and exists (
    select 1
    from public.supplier_documents sd
    where sd.id = supplier_document_id
      and sd.company_id = supplier_catalog_versions.company_id
  )
  and (
    catalog_id is null
    or exists (
      select 1
      from public.supplier_catalogs sc
      where sc.id = catalog_id
        and sc.company_id = supplier_catalog_versions.company_id
    )
  )
);

create policy "supplier_catalog_lines_read_company_member"
on public.supplier_catalog_lines
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "supplier_catalog_lines_write_company_member"
on public.supplier_catalog_lines
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
  and exists (
    select 1
    from public.supplier_catalog_versions scv
    where scv.id = supplier_catalog_version_id
      and scv.company_id = supplier_catalog_lines.company_id
  )
  and (
    matched_item_id is null
    or exists (
      select 1
      from public.items i
      where i.id = matched_item_id
        and i.company_id = supplier_catalog_lines.company_id
    )
  )
);

create policy "supplier_import_mappings_read_company_member"
on public.supplier_import_mappings
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
);

create policy "supplier_import_mappings_write_company_member"
on public.supplier_import_mappings
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'suppliers.edit')
  and exists (
    select 1
    from public.suppliers s
    where s.id = supplier_id
      and s.company_id = supplier_import_mappings.company_id
  )
);

create or replace function public.create_supplier_catalog_import(
  p_supplier_id uuid,
  p_supplier_document_id uuid,
  p_catalog_id uuid default null,
  p_catalog_title text default null,
  p_catalog_notes text default null,
  p_version_title text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_catalog_id uuid;
  v_version_id uuid;
  v_inserted_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.company_id
  into v_company_id
  from public.suppliers s
  where s.id = p_supplier_id;

  if v_company_id is null then
    raise exception 'Proveedor no encontrado';
  end if;

  if not public.has_company_permission(v_uid, v_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para importar catalogos';
  end if;

  if not exists (
    select 1
    from public.supplier_documents d
    where d.id = p_supplier_document_id
      and d.supplier_id = p_supplier_id
      and d.company_id = v_company_id
  ) then
    raise exception 'No autorizado para usar el documento indicado';
  end if;

  if p_catalog_id is not null then
    select c.id
      into v_catalog_id
    from public.supplier_catalogs c
    where c.id = p_catalog_id
      and c.supplier_id = p_supplier_id
      and c.company_id = v_company_id
    limit 1;

    if v_catalog_id is null then
      raise exception 'No autorizado para usar el catalogo indicado';
    end if;
  else
    insert into public.supplier_catalogs (company_id, supplier_id, title, notes, created_by)
    values (
      v_company_id,
      p_supplier_id,
      coalesce(nullif(trim(p_catalog_title), ''), 'Listado sin titulo'),
      nullif(trim(p_catalog_notes), ''),
      v_uid
    )
    returning id into v_catalog_id;
  end if;

  insert into public.supplier_catalog_versions (
    company_id,
    supplier_id,
    catalog_id,
    supplier_document_id,
    title,
    created_by
  )
  values (
    v_company_id,
    p_supplier_id,
    v_catalog_id,
    p_supplier_document_id,
    nullif(trim(p_version_title), ''),
    v_uid
  )
  returning id into v_version_id;

  if jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) > 0 then
    insert into public.supplier_catalog_lines (
      company_id,
      supplier_catalog_version_id,
      supplier_code,
      raw_description,
      normalized_description,
      cost,
      currency,
      row_index,
      matched_item_id,
      match_status,
      created_by
    )
    select
      v_company_id,
      v_version_id,
      nullif(trim(x.supplier_code), ''),
      trim(x.raw_description),
      nullif(trim(x.normalized_description), ''),
      x.cost,
      coalesce(nullif(upper(trim(x.currency)), ''), 'ARS'),
      x.row_index,
      x.matched_item_id,
      coalesce(x.match_status, 'PENDING'::public.match_status),
      v_uid
    from jsonb_to_recordset(p_lines) as x(
      supplier_code text,
      raw_description text,
      normalized_description text,
      cost numeric,
      currency text,
      row_index integer,
      matched_item_id uuid,
      match_status public.match_status
    )
    where nullif(trim(x.raw_description), '') is not null
      and x.cost is not null
      and x.cost > 0;

    get diagnostics v_inserted_count = row_count;
  end if;

  return jsonb_build_object(
    'catalog_id', v_catalog_id,
    'version_id', v_version_id,
    'inserted_count', v_inserted_count
  );
end;
$$;

revoke all on function public.create_supplier_catalog_import(uuid, uuid, uuid, text, text, text, jsonb) from public;
grant execute on function public.create_supplier_catalog_import(uuid, uuid, uuid, text, text, text, jsonb) to authenticated;
