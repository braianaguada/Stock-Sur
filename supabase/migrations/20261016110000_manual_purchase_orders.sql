begin;

alter table public.supplier_purchase_orders alter column source_catalog_version_id drop not null;
alter table public.supplier_purchase_orders add column request_id uuid;
alter table public.supplier_purchase_orders add column form_data jsonb not null default '{}'::jsonb check (jsonb_typeof(form_data) = 'object');
create unique index supplier_purchase_orders_request_idx on public.supplier_purchase_orders(company_id, request_id) where request_id is not null;

-- All saved orders and blank forms share a counter. Historical numbers stay unchanged.
create function public.assign_purchase_order_number() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_max bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('purchase-order-print:' || new.company_id::text, 0));
  select coalesce(max(order_number), 0) into v_max from public.supplier_purchase_orders where company_id = new.company_id;
  insert into public.purchase_order_print_counters(company_id, last_number) values(new.company_id, v_max + 1)
    on conflict(company_id) do update set last_number = greatest(purchase_order_print_counters.last_number, v_max) + 1
    returning last_number into new.order_number;
  return new;
end;
$$;
revoke all on function public.assign_purchase_order_number() from public, anon, authenticated;
create trigger assign_purchase_order_number before insert on public.supplier_purchase_orders
for each row execute function public.assign_purchase_order_number();

create function public.save_manual_purchase_order(p_company_id uuid, p_request_id uuid, p_order_id uuid, p_supplier_id uuid, p_form jsonb, p_lines jsonb)
returns public.supplier_purchase_orders language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_order public.supplier_purchase_orders;
  v_supplier public.suppliers;
  v_line jsonb;
  v_index integer := 0;
  v_totals jsonb;
begin
  if v_uid is null or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE')
    or (not public.is_superadmin(v_uid) and not public.is_company_member(v_uid, p_company_id))
    or not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No tenés permiso para cargar órdenes en esta empresa';
  end if;
  if p_request_id is null then raise exception 'Falta el identificador de la operación'; end if;
  if p_form is null or jsonb_typeof(p_form) <> 'object' or length(p_form::text) > 12000 then raise exception 'Datos de cabecera inválidos'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then raise exception 'Ingresá los productos de la orden'; end if;
  if jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'Ingresá entre 1 y 200 productos'; end if;
  select * into v_supplier from public.suppliers where id = p_supplier_id and company_id = p_company_id and is_active = true;
  if not found then raise exception 'Seleccioná un proveedor activo de esta empresa'; end if;
  -- Same lock as catalog creation, then numbering lock in the insert trigger.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));
  if p_order_id is null then
    select * into v_order from public.supplier_purchase_orders where company_id = p_company_id and request_id = p_request_id;
    if found then return v_order; end if;
    insert into public.supplier_purchase_orders(company_id, supplier_id, order_number, supplier_name_snapshot, request_id, form_data, notes, created_by)
      values(p_company_id, p_supplier_id, 0, v_supplier.name, p_request_id, p_form, p_form->>'notes', v_uid) returning * into v_order;
  else
    select * into v_order from public.supplier_purchase_orders where id = p_order_id and company_id = p_company_id for update;
    if not found or v_order.status <> 'DRAFT' or v_order.source_catalog_version_id is not null then raise exception 'Solo se pueden editar órdenes manuales en borrador'; end if;
    update public.supplier_purchase_orders set supplier_id = p_supplier_id, supplier_name_snapshot = v_supplier.name,
      form_data = p_form, notes = p_form->>'notes', updated_at = now() where id = v_order.id;
    delete from public.supplier_purchase_order_lines where company_id = p_company_id and purchase_order_id = v_order.id;
  end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_index := v_index + 1;
    if nullif(btrim(v_line->>'description'), '') is null or length(v_line->>'description') > 240
      or coalesce(v_line->>'currency','') not in ('ARS','USD')
      or coalesce((v_line->>'quantity')::numeric, 0) <= 0
      or (v_line->>'quantity')::numeric <> trunc((v_line->>'quantity')::numeric)
      or (v_line->>'quantity')::numeric > 1000000
      or coalesce((v_line->>'unit_cost')::numeric, 0) < 0.01
      or length(coalesce(v_line->>'code', '')) > 100
      or (v_line->>'unit_cost')::numeric > 1000000000 then raise exception 'Revisá descripción, cantidad entera y costo positivo de cada producto'; end if;
    insert into public.supplier_purchase_order_lines(company_id, purchase_order_id, line_order, product_name_snapshot, raw_description_snapshot, supplier_code_snapshot, quantity, currency, unit_cost)
      values(p_company_id, v_order.id, v_index, btrim(v_line->>'description'), btrim(v_line->>'description'), nullif(v_line->>'code',''), (v_line->>'quantity')::integer, v_line->>'currency', round((v_line->>'unit_cost')::numeric, 2));
  end loop;
  select jsonb_object_agg(currency, amount) into v_totals from
    (select currency, sum(line_total) as amount from public.supplier_purchase_order_lines where company_id = p_company_id and purchase_order_id = v_order.id group by currency) t;
  update public.supplier_purchase_orders set totals_by_currency = v_totals where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;
revoke all on function public.save_manual_purchase_order(uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_manual_purchase_order(uuid, uuid, uuid, uuid, jsonb, jsonb) to authenticated;

create or replace function public.reserve_purchase_order_print_sheets(p_company_id uuid, p_request_id uuid, p_sheet_count integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first bigint;
  v_sheets integer;
  v_max bigint;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if p_request_id is null then raise exception 'Falta el identificador de impresión'; end if;
  if p_sheet_count is null or p_sheet_count < 1 or p_sheet_count > 100 then
    raise exception 'La cantidad de hojas debe ser un entero entre 1 y 100';
  end if;
  if not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE')
    or (not public.is_superadmin(v_uid) and not public.is_company_member(v_uid, p_company_id))
    or not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No tenés permiso para imprimir órdenes en esta empresa';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('purchase-order-print:' || p_company_id::text, 0));
  select first_number, sheet_count into v_first, v_sheets from public.purchase_order_print_batches
    where company_id = p_company_id and request_id = p_request_id;
  if v_first is null then
    select coalesce(max(order_number), 0) into v_max from public.supplier_purchase_orders where company_id = p_company_id;
    insert into public.purchase_order_print_counters(company_id, last_number) values (p_company_id, v_max + p_sheet_count * 2)
      on conflict (company_id) do update set last_number = greatest(purchase_order_print_counters.last_number, v_max) + p_sheet_count * 2
      returning last_number - p_sheet_count * 2 + 1 into v_first;
    insert into public.purchase_order_print_batches(company_id, request_id, first_number, sheet_count, created_by)
      values (p_company_id, p_request_id, v_first, p_sheet_count, v_uid);
  elsif v_sheets <> p_sheet_count then
    raise exception 'Este lote ya fue reservado con otra cantidad de hojas';
  end if;
  return jsonb_build_object('firstNumber', v_first, 'secondNumber', v_first + 1,
    'lastNumber', v_first + p_sheet_count * 2 - 1, 'sheetCount', p_sheet_count);
end;
$$;
revoke all on function public.reserve_purchase_order_print_sheets(uuid, uuid, integer) from public, anon;
grant execute on function public.reserve_purchase_order_print_sheets(uuid, uuid, integer) to authenticated;


commit;
