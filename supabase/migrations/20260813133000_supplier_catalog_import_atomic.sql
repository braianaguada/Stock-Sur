create or replace function public.create_supplier_catalog_import_atomic(
  p_supplier_id uuid,
  p_document_title text,
  p_file_name text,
  p_file_type text,
  p_document_notes text default null,
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
  v_document_id uuid;
  v_catalog_id uuid;
  v_version_id uuid;
  v_inserted_count integer := 0;
  v_line_count integer := 0;
  v_version_currency text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.company_id
    into v_company_id
  from public.suppliers s
  where s.id = p_supplier_id
    and s.is_active = true;

  if v_company_id is null then
    raise exception 'Proveedor no encontrado o inactivo';
  end if;
  if not public.has_company_permission(v_uid, v_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para importar catalogos';
  end if;
  if nullif(trim(p_document_title), '') is null or nullif(trim(p_file_name), '') is null then
    raise exception 'El documento y el archivo deben tener nombre';
  end if;
  if lower(trim(p_file_type)) not in ('xlsx', 'csv', 'pdf') then
    raise exception 'Formato de archivo no soportado';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'No hay lineas para importar';
  end if;

  v_line_count := jsonb_array_length(p_lines);

  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as x(
      raw_description text, cost numeric, currency text, content_unit text,
      package_quantity numeric, content_value numeric, reference_unit_price numeric
    )
    where nullif(trim(x.raw_description), '') is null
       or x.cost is null or x.cost <= 0
       or upper(coalesce(trim(x.currency), '')) not in ('ARS', 'USD')
       or (x.package_quantity is not null and x.package_quantity <= 0)
       or (x.content_value is not null and x.content_value <= 0)
       or (x.reference_unit_price is not null and x.reference_unit_price <= 0)
       or (x.content_unit is not null and upper(trim(x.content_unit)) not in ('UNIT', 'MG', 'G', 'KG', 'ML', 'CC', 'L', 'M', 'M2', 'M3'))
  ) then
    raise exception 'La lista contiene filas invalidas; revisa nombre, precio, moneda y presentacion';
  end if;

  if p_catalog_id is not null then
    select c.id into v_catalog_id
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
      coalesce(nullif(trim(p_catalog_title), ''), trim(p_document_title)),
      nullif(trim(p_catalog_notes), ''),
      v_uid
    )
    returning id into v_catalog_id;
  end if;

  insert into public.supplier_documents (
    company_id, supplier_id, title, file_name, file_type, notes, created_by
  ) values (
    v_company_id, p_supplier_id, trim(p_document_title), trim(p_file_name),
    lower(trim(p_file_type)), nullif(trim(p_document_notes), ''), v_uid
  ) returning id into v_document_id;

  select case
    when count(distinct upper(trim(value ->> 'currency'))) = 1
      then min(upper(trim(value ->> 'currency')))
    else null
  end into v_version_currency
  from jsonb_array_elements(p_lines);

  insert into public.supplier_catalog_versions (
    company_id, supplier_id, catalog_id, supplier_document_id, title, currency,
    accepted_row_count, rejected_row_count, created_by
  ) values (
    v_company_id, p_supplier_id, v_catalog_id, v_document_id,
    nullif(trim(p_version_title), ''), v_version_currency, v_line_count, 0, v_uid
  ) returning id into v_version_id;

  insert into public.supplier_catalog_lines (
    company_id, supplier_catalog_version_id, supplier_code, raw_description,
    normalized_description, product_name, additional_description, presentation_raw,
    package_quantity, content_value, content_unit, semantic_detection,
    cost, currency, tax_treatment, reference_unit_price, reference_price_basis,
    row_index, matched_item_id, match_status, created_by
  )
  select
    v_company_id, v_version_id, nullif(trim(x.supplier_code), ''), trim(x.raw_description),
    nullif(trim(x.normalized_description), ''), coalesce(nullif(trim(x.product_name), ''), trim(x.raw_description)),
    nullif(trim(x.additional_description), ''), nullif(trim(x.presentation_raw), ''),
    x.package_quantity, x.content_value, nullif(upper(trim(x.content_unit)), ''), coalesce(x.semantic_detection, '{}'::jsonb),
    x.cost, upper(trim(x.currency)),
    case when upper(coalesce(trim(x.tax_treatment), 'UNKNOWN')) in ('INCLUDED', 'EXCLUDED', 'UNKNOWN')
      then upper(coalesce(trim(x.tax_treatment), 'UNKNOWN')) else 'UNKNOWN' end,
    x.reference_unit_price, nullif(trim(x.reference_price_basis), ''),
    x.row_index, x.matched_item_id, coalesce(x.match_status, 'PENDING'::public.match_status), v_uid
  from jsonb_to_recordset(p_lines) as x(
    supplier_code text, raw_description text, normalized_description text,
    product_name text, additional_description text, presentation_raw text,
    package_quantity numeric, content_value numeric, content_unit text, semantic_detection jsonb,
    cost numeric, currency text, tax_treatment text,
    reference_unit_price numeric, reference_price_basis text,
    row_index integer, matched_item_id uuid, match_status public.match_status
  );

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count <> v_line_count then
    raise exception 'La importacion quedo incompleta: % de % filas', v_inserted_count, v_line_count;
  end if;

  return jsonb_build_object(
    'document_id', v_document_id,
    'catalog_id', v_catalog_id,
    'version_id', v_version_id,
    'inserted_count', v_inserted_count,
    'rejected_count', 0
  );
end;
$$;

revoke all on function public.create_supplier_catalog_import_atomic(uuid, text, text, text, text, uuid, text, text, text, jsonb) from public;
grant execute on function public.create_supplier_catalog_import_atomic(uuid, text, text, text, text, uuid, text, text, text, jsonb) to authenticated;

comment on function public.create_supplier_catalog_import_atomic(uuid, text, text, text, text, uuid, text, text, text, jsonb) is
  'Crea documento, catalogo/version y lineas en una unica transaccion, con validacion estricta y aislamiento por empresa.';
