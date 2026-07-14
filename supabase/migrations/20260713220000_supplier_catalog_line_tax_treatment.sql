alter table public.supplier_catalog_lines
  add column if not exists tax_treatment text not null default 'UNKNOWN';

alter table public.supplier_catalog_lines
  drop constraint if exists supplier_catalog_lines_tax_treatment_check;

alter table public.supplier_catalog_lines
  add constraint supplier_catalog_lines_tax_treatment_check
  check (tax_treatment in ('INCLUDED', 'EXCLUDED', 'UNKNOWN'));

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
      tax_treatment,
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
      case
        when upper(coalesce(trim(x.tax_treatment), 'UNKNOWN')) in ('INCLUDED', 'EXCLUDED', 'UNKNOWN')
          then upper(coalesce(trim(x.tax_treatment), 'UNKNOWN'))
        else 'UNKNOWN'
      end,
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
      tax_treatment text,
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
