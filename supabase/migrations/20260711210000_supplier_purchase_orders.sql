alter table public.supplier_catalog_lines
  add column if not exists reference_unit_price numeric,
  add column if not exists reference_price_basis text;

alter table public.supplier_catalog_lines
  add constraint supplier_catalog_lines_reference_unit_price_positive
    check (reference_unit_price is null or reference_unit_price > 0);

comment on column public.supplier_catalog_lines.reference_unit_price is
  'Precio normalizado para comparar una unidad de la base indicada; no reemplaza cost.';
comment on column public.supplier_catalog_lines.reference_price_basis is
  'Encabezado o base informada por el archivo para interpretar el precio de referencia.';

create table public.supplier_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  supplier_id uuid not null references public.suppliers(id),
  source_catalog_version_id uuid not null references public.supplier_catalog_versions(id),
  order_number bigint not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SENT', 'CANCELLED')),
  supplier_name_snapshot text not null,
  notes text,
  totals_by_currency jsonb not null default '{}'::jsonb
    check (jsonb_typeof(totals_by_currency) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_number),
  unique (company_id, id)
);

create table public.supplier_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  purchase_order_id uuid not null,
  source_catalog_line_id uuid references public.supplier_catalog_lines(id),
  line_order integer not null check (line_order > 0),
  supplier_code_snapshot text,
  product_name_snapshot text not null,
  raw_description_snapshot text not null,
  additional_description_snapshot text,
  presentation_raw_snapshot text,
  package_quantity_snapshot numeric,
  content_value_snapshot numeric,
  content_unit_snapshot text,
  quantity integer not null check (quantity > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  unit_cost numeric not null check (unit_cost > 0),
  line_total numeric generated always as (quantity * unit_cost) stored,
  reference_unit_price_snapshot numeric,
  reference_price_basis_snapshot text,
  created_at timestamptz not null default now(),
  unique (purchase_order_id, line_order),
  foreign key (company_id, purchase_order_id)
    references public.supplier_purchase_orders(company_id, id) on delete cascade,
  check (package_quantity_snapshot is null or package_quantity_snapshot > 0),
  check (content_value_snapshot is null or content_value_snapshot > 0),
  check (reference_unit_price_snapshot is null or reference_unit_price_snapshot > 0)
);

create index supplier_purchase_orders_company_supplier_created_idx
  on public.supplier_purchase_orders(company_id, supplier_id, created_at desc);
create index supplier_purchase_order_lines_company_order_idx
  on public.supplier_purchase_order_lines(company_id, purchase_order_id, line_order);

alter table public.supplier_purchase_orders enable row level security;
alter table public.supplier_purchase_order_lines enable row level security;

create policy "supplier_purchase_orders_read_active_company"
on public.supplier_purchase_orders for select to authenticated
using (
  public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);

create policy "supplier_purchase_order_lines_read_active_company"
on public.supplier_purchase_order_lines for select to authenticated
using (
  public.has_company_permission(auth.uid(), company_id, 'suppliers.view')
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);

revoke insert, update, delete, truncate on public.supplier_purchase_orders from authenticated;
revoke insert, update, delete, truncate on public.supplier_purchase_order_lines from authenticated;
grant select on public.supplier_purchase_orders to authenticated;
grant select on public.supplier_purchase_order_lines to authenticated;

-- Keep the import RPC compatible while adding the two optional reference-price fields.
create or replace function public.create_supplier_catalog_import(
  p_supplier_id uuid,
  p_supplier_document_id uuid,
  p_catalog_id uuid default null,
  p_catalog_title text default null,
  p_catalog_notes text default null,
  p_version_title text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_catalog_id uuid;
  v_version_id uuid;
  v_inserted_count integer := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select s.company_id into v_company_id from public.suppliers s where s.id = p_supplier_id;
  if v_company_id is null then raise exception 'Proveedor no encontrado'; end if;
  if not exists (select 1 from public.companies c where c.id = v_company_id and c.status = 'ACTIVE') then
    raise exception 'La empresa no esta activa';
  end if;
  if not public.has_company_permission(v_uid, v_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para importar catalogos';
  end if;
  if not exists (
    select 1 from public.supplier_documents d
    where d.id = p_supplier_document_id and d.supplier_id = p_supplier_id and d.company_id = v_company_id
  ) then raise exception 'No autorizado para usar el documento indicado'; end if;

  if p_catalog_id is not null then
    select c.id into v_catalog_id from public.supplier_catalogs c
    where c.id = p_catalog_id and c.supplier_id = p_supplier_id and c.company_id = v_company_id limit 1;
    if v_catalog_id is null then raise exception 'No autorizado para usar el catalogo indicado'; end if;
  else
    insert into public.supplier_catalogs (company_id, supplier_id, title, notes, created_by)
    values (v_company_id, p_supplier_id, coalesce(nullif(trim(p_catalog_title), ''), 'Listado sin titulo'), nullif(trim(p_catalog_notes), ''), v_uid)
    returning id into v_catalog_id;
  end if;

  insert into public.supplier_catalog_versions (company_id, supplier_id, catalog_id, supplier_document_id, title, created_by)
  values (v_company_id, p_supplier_id, v_catalog_id, p_supplier_document_id, nullif(trim(p_version_title), ''), v_uid)
  returning id into v_version_id;

  if jsonb_typeof(p_lines) = 'array' and jsonb_array_length(p_lines) > 0 then
    insert into public.supplier_catalog_lines (
      company_id, supplier_catalog_version_id, supplier_code, raw_description,
      normalized_description, product_name, additional_description, presentation_raw,
      package_quantity, content_value, content_unit, semantic_detection,
      reference_unit_price, reference_price_basis,
      cost, currency, row_index, matched_item_id, match_status, created_by
    )
    select
      v_company_id, v_version_id, nullif(trim(x.supplier_code), ''), trim(x.raw_description),
      nullif(trim(x.normalized_description), ''), coalesce(nullif(trim(x.product_name), ''), trim(x.raw_description)),
      nullif(trim(x.additional_description), ''), nullif(trim(x.presentation_raw), ''),
      x.package_quantity, x.content_value, nullif(upper(trim(x.content_unit)), ''), coalesce(x.semantic_detection, '{}'::jsonb),
      x.reference_unit_price, nullif(trim(x.reference_price_basis), ''),
      x.cost, coalesce(nullif(upper(trim(x.currency)), ''), 'ARS'), x.row_index,
      x.matched_item_id, coalesce(x.match_status, 'PENDING'::public.match_status), v_uid
    from jsonb_to_recordset(p_lines) as x(
      supplier_code text, raw_description text, normalized_description text,
      product_name text, additional_description text, presentation_raw text,
      package_quantity numeric, content_value numeric, content_unit text, semantic_detection jsonb,
      reference_unit_price numeric, reference_price_basis text,
      cost numeric, currency text, row_index integer, matched_item_id uuid, match_status public.match_status
    )
    where nullif(trim(x.raw_description), '') is not null and x.cost is not null and x.cost > 0;
    get diagnostics v_inserted_count = row_count;
  end if;
  return jsonb_build_object('catalog_id', v_catalog_id, 'version_id', v_version_id, 'inserted_count', v_inserted_count);
end;
$$;

revoke all on function public.create_supplier_catalog_import(uuid, uuid, uuid, text, text, text, jsonb) from public;
grant execute on function public.create_supplier_catalog_import(uuid, uuid, uuid, text, text, text, jsonb) to authenticated;

create or replace function public.create_supplier_purchase_order(
  p_company_id uuid,
  p_supplier_id uuid,
  p_catalog_version_id uuid,
  p_lines jsonb,
  p_notes text default null
)
returns public.supplier_purchase_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.supplier_purchase_orders;
  v_supplier_name text;
  v_order_number bigint;
  v_requested_count integer;
  v_valid_count integer;
  v_totals jsonb;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_company_id is null then raise exception 'Empresa requerida'; end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.status = 'ACTIVE') then
    raise exception 'La empresa no esta activa';
  end if;
  if not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para generar ordenes de compra';
  end if;

  select s.name into v_supplier_name
  from public.suppliers s
  where s.id = p_supplier_id and s.company_id = p_company_id and s.is_active;
  if v_supplier_name is null then raise exception 'Proveedor activo no encontrado'; end if;

  if not exists (
    select 1 from public.supplier_catalog_versions v
    where v.id = p_catalog_version_id and v.company_id = p_company_id and v.supplier_id = p_supplier_id
  ) then raise exception 'La version no pertenece al proveedor y empresa indicados'; end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Los renglones deben ser un array'; end if;
  v_requested_count := jsonb_array_length(p_lines);
  if v_requested_count = 0 then raise exception 'La orden debe incluir al menos un producto'; end if;
  if v_requested_count > 5000 then raise exception 'La orden supera el maximo de 5000 productos'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_lines) x(catalog_line_id uuid, quantity integer)
    where x.catalog_line_id is null or x.quantity is null or x.quantity <= 0
  ) then raise exception 'Cada renglon requiere producto y cantidad entera positiva'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) x(catalog_line_id uuid, quantity integer)
    group by x.catalog_line_id having count(*) > 1
  ) then raise exception 'La orden contiene productos repetidos'; end if;

  select count(*) into v_valid_count
  from jsonb_to_recordset(p_lines) x(catalog_line_id uuid, quantity integer)
  join public.supplier_catalog_lines l
    on l.id = x.catalog_line_id
   and l.company_id = p_company_id
   and l.supplier_catalog_version_id = p_catalog_version_id
  where l.cost > 0 and l.currency in ('ARS', 'USD');
  if v_valid_count <> v_requested_count then
    raise exception 'Uno o mas productos no pertenecen a la lista o tienen precio/moneda invalidos';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));
  select coalesce(max(o.order_number), 0) + 1 into v_order_number
  from public.supplier_purchase_orders o where o.company_id = p_company_id;

  insert into public.supplier_purchase_orders (
    company_id, supplier_id, source_catalog_version_id, order_number,
    supplier_name_snapshot, notes, created_by
  ) values (
    p_company_id, p_supplier_id, p_catalog_version_id, v_order_number,
    v_supplier_name, nullif(trim(p_notes), ''), v_uid
  ) returning * into v_order;

  insert into public.supplier_purchase_order_lines (
    company_id, purchase_order_id, source_catalog_line_id, line_order,
    supplier_code_snapshot, product_name_snapshot, raw_description_snapshot,
    additional_description_snapshot, presentation_raw_snapshot,
    package_quantity_snapshot, content_value_snapshot, content_unit_snapshot,
    quantity, currency, unit_cost, reference_unit_price_snapshot, reference_price_basis_snapshot
  )
  select
    p_company_id, v_order.id, l.id, x.ordinality::integer,
    l.supplier_code, coalesce(nullif(trim(l.product_name), ''), l.raw_description), l.raw_description,
    l.additional_description, l.presentation_raw, l.package_quantity, l.content_value, l.content_unit,
    (x.line ->> 'quantity')::integer, l.currency, l.cost, l.reference_unit_price, l.reference_price_basis
  from jsonb_array_elements(p_lines) with ordinality as x(line, ordinality)
  join public.supplier_catalog_lines l on l.id = (x.line ->> 'catalog_line_id')::uuid
  order by x.ordinality;

  select coalesce(jsonb_object_agg(t.currency, t.total order by t.currency), '{}'::jsonb)
  into v_totals
  from (
    select l.currency, sum(l.line_total) as total
    from public.supplier_purchase_order_lines l
    where l.purchase_order_id = v_order.id and l.company_id = p_company_id
    group by l.currency
  ) t;

  update public.supplier_purchase_orders
  set totals_by_currency = v_totals, updated_at = now()
  where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.create_supplier_purchase_order(uuid, uuid, uuid, jsonb, text) from public;
grant execute on function public.create_supplier_purchase_order(uuid, uuid, uuid, jsonb, text) to authenticated;

comment on table public.supplier_purchase_orders is
  'Ordenes de compra persistidas; los datos visibles y totales quedan congelados al confirmar.';
