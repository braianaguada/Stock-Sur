-- Staging only: npx supabase db query --linked --file scripts/supplier-lists-cart-qa.sql
-- Only temporary test suppliers/lists and DRAFT orders. Everything rolls back.
begin;
do $$
declare
  actor uuid; company uuid;
  supplier uuid := gen_random_uuid(); other_supplier uuid := gen_random_uuid();
  catalog uuid := gen_random_uuid(); document uuid := gen_random_uuid();
  other_catalog uuid := gen_random_uuid(); other_document uuid := gen_random_uuid();
  first_version uuid := gen_random_uuid(); second_version uuid := gen_random_uuid();
  other_version uuid := gen_random_uuid(); first_line uuid := gen_random_uuid();
  second_line uuid := gen_random_uuid(); other_line uuid := gen_random_uuid();
  unknown_line uuid := gen_random_uuid(); result public.supplier_purchase_orders;
begin
  if has_function_privilege('anon', 'public.create_supplier_purchase_order(uuid,uuid,uuid,jsonb,text)', 'execute') then
    raise exception 'Anonymous execute granted';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.create_supplier_purchase_order(gen_random_uuid(), supplier, first_version, '[]'::jsonb);
    raise exception 'Anonymous accepted';
  exception when raise_exception then
    if sqlerrm <> 'No autenticado' then raise; end if;
  end;
  select cu.user_id, cu.company_id into actor, company from public.company_users cu
    join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
    where public.is_company_member(cu.user_id, cu.company_id)
      and public.has_company_permission(cu.user_id, cu.company_id, 'suppliers.edit') limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  insert into public.suppliers (id, company_id, name, vat_rate, freight_rate) values
    (supplier, company, 'QA cart temporary', 21, 5), (other_supplier, company, 'QA other temporary', 10.5, 0);
  insert into public.supplier_catalogs (id, company_id, supplier_id, title)
    values (catalog, company, supplier, 'QA list'), (other_catalog, company, other_supplier, 'QA other list');
  insert into public.supplier_documents (id, company_id, supplier_id, title, file_name, file_type)
    values (document, company, supplier, 'QA source', 'qa.xlsx', 'xlsx'),
      (other_document, company, other_supplier, 'QA other source', 'qa.xlsx', 'xlsx');
  insert into public.supplier_catalog_versions (id, company_id, supplier_id, catalog_id, supplier_document_id)
    values (first_version, company, supplier, catalog, document),
      (second_version, company, supplier, catalog, document),
      (other_version, company, other_supplier, other_catalog, other_document);
  insert into public.supplier_catalog_lines (id, company_id, supplier_catalog_version_id, raw_description, cost, currency, tax_treatment)
    values (first_line, company, first_version, 'QA net', 100, 'ARS', 'EXCLUDED'),
      (second_line, company, second_version, 'QA included', 121, 'USD', 'INCLUDED'),
      (other_line, company, other_version, 'QA foreign supplier', 10, 'ARS', 'EXCLUDED'),
      (unknown_line, company, first_version, 'QA unknown VAT', 10, 'ARS', 'UNKNOWN');
  result := public.create_supplier_purchase_order(company, supplier, first_version,
    jsonb_build_array(jsonb_build_object('catalog_line_id', first_line, 'quantity', 2),
      jsonb_build_object('catalog_line_id', second_line, 'quantity', 1)), 'QA rollback');
  if result.status <> 'DRAFT' or result.vat_rate_snapshot <> 21 or result.freight_rate_snapshot <> 5
    or (result.totals_by_currency->>'ARS')::numeric <> 200
    or abs((result.totals_by_currency->>'USD')::numeric - 100) > 0.000001
    or (select count(*) from public.supplier_purchase_order_lines where purchase_order_id = result.id) <> 2 then
    raise exception 'Mixed-list net totals/snapshots failed';
  end if;
  update public.suppliers set vat_rate = 10.5, freight_rate = 8 where id = supplier;
  if exists (select 1 from public.supplier_purchase_orders where id = result.id
    and (vat_rate_snapshot <> 21 or freight_rate_snapshot <> 5)) then
    raise exception 'Order snapshot changed';
  end if;
  begin
    perform public.create_supplier_purchase_order(company, supplier, first_version,
      jsonb_build_array(jsonb_build_object('catalog_line_id', other_line, 'quantity', 1)));
    raise exception 'Foreign supplier line accepted';
  exception when raise_exception then
    if sqlerrm <> 'Uno o mas productos no pertenecen al proveedor o tienen precio, moneda o IVA invalidos' then raise; end if;
  end;
  begin
    perform public.create_supplier_purchase_order(company, supplier, first_version,
      jsonb_build_array(jsonb_build_object('catalog_line_id', unknown_line, 'quantity', 1)));
    raise exception 'Unknown VAT accepted';
  exception when raise_exception then
    if sqlerrm <> 'Uno o mas productos no pertenecen al proveedor o tienen precio, moneda o IVA invalidos' then raise; end if;
  end;
  begin
    perform public.create_supplier_purchase_order(company, supplier, first_version,
      jsonb_build_array(jsonb_build_object('catalog_line_id', first_line, 'quantity', 0)));
    raise exception 'Zero quantity accepted';
  exception when raise_exception then
    if sqlerrm <> 'Cada renglon requiere producto y cantidad entera positiva' then raise; end if;
  end;
  begin
    perform public.create_supplier_purchase_order(gen_random_uuid(), supplier, first_version, '[]'::jsonb);
    raise exception 'Foreign company accepted';
  exception when raise_exception then
    if sqlerrm <> 'La empresa no esta activa' then raise; end if;
  end;
  update public.suppliers set is_active = false where id = supplier;
  begin
    perform public.create_supplier_purchase_order(company, supplier, first_version, '[]'::jsonb);
    raise exception 'Inactive supplier accepted';
  exception when raise_exception then
    if sqlerrm <> 'Proveedor activo no encontrado' then raise; end if;
  end;
end $$;
rollback;
