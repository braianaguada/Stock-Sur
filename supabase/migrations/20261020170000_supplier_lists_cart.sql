begin;

alter table public.suppliers
  add column vat_rate numeric not null default 21 check (vat_rate between 0 and 100),
  add column freight_rate numeric not null default 0 check (freight_rate between 0 and 100);

-- Existing orders keep their original totals: no retroactive tax or freight.
alter table public.supplier_purchase_orders
  add column vat_rate_snapshot numeric not null default 0 check (vat_rate_snapshot between 0 and 100),
  add column freight_rate_snapshot numeric not null default 0 check (freight_rate_snapshot between 0 and 100);

comment on column public.supplier_purchase_orders.totals_by_currency is
  'Net amounts by original currency. Apply frozen vat_rate_snapshot and freight_rate_snapshot over net for grand totals.';
comment on column public.suppliers.freight_rate is
  'Freight percentage over net amount, separate from product VAT.';

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
  v_vat_rate numeric;
  v_freight_rate numeric;
  v_source_version_id uuid;
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

  select s.name, s.vat_rate, s.freight_rate into v_supplier_name, v_vat_rate, v_freight_rate
  from public.suppliers s
  where s.id = p_supplier_id and s.company_id = p_company_id and s.is_active for share;
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

  -- Lock all requested source rows before validation and snapshotting.
  perform l.id from public.supplier_catalog_lines l
  join public.supplier_catalog_versions v on v.id = l.supplier_catalog_version_id
  join jsonb_to_recordset(p_lines) x(catalog_line_id uuid, quantity integer) on x.catalog_line_id = l.id
  where l.company_id = p_company_id and v.company_id = p_company_id and v.supplier_id = p_supplier_id
  order by l.id for share of l, v;

  select count(*) into v_valid_count
  from jsonb_to_recordset(p_lines) x(catalog_line_id uuid, quantity integer)
  join public.supplier_catalog_lines l
    on l.id = x.catalog_line_id
   and l.company_id = p_company_id
  join public.supplier_catalog_versions v on v.id = l.supplier_catalog_version_id
   and v.company_id = p_company_id and v.supplier_id = p_supplier_id
  where l.cost > 0 and l.currency in ('ARS', 'USD') and l.tax_treatment in ('INCLUDED', 'EXCLUDED');
  if v_valid_count <> v_requested_count then
    raise exception 'Uno o mas productos no pertenecen al proveedor o tienen precio, moneda o IVA invalidos';
  end if;

  -- Header retains one source for compatibility; each order line records its actual source.
  select l.supplier_catalog_version_id into v_source_version_id
  from public.supplier_catalog_lines l
  where l.id = (p_lines->0->>'catalog_line_id')::uuid and l.company_id = p_company_id;

  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));
  select coalesce(max(o.order_number), 0) + 1 into v_order_number
  from public.supplier_purchase_orders o where o.company_id = p_company_id;

  insert into public.supplier_purchase_orders (
    company_id, supplier_id, source_catalog_version_id, order_number,
    supplier_name_snapshot, notes, created_by, vat_rate_snapshot, freight_rate_snapshot
  ) values (
    p_company_id, p_supplier_id, v_source_version_id, v_order_number,
    v_supplier_name, nullif(trim(p_notes), ''), v_uid, v_vat_rate, v_freight_rate
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
    (x.line ->> 'quantity')::integer, l.currency, case when l.tax_treatment = 'INCLUDED' then l.cost / (1 + v_vat_rate / 100) else l.cost end, l.reference_unit_price, l.reference_price_basis
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


commit;
