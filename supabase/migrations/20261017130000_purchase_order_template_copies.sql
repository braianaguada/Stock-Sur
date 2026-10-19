begin;

-- Legacy clients reserve two distinct numbers per sheet. Preserve their batches
-- and RPC while new clients reserve one number for each original/duplicate pair.
alter table public.purchase_order_print_batches
  add column if not exists numbers_per_sheet integer not null default 2
  check (numbers_per_sheet in (1, 2));

create or replace function public.reserve_purchase_order_template_sheets(p_company_id uuid, p_request_id uuid, p_sheet_count integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first bigint;
  v_sheets integer;
  v_numbers_per_sheet integer;
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
  select first_number, sheet_count, numbers_per_sheet into v_first, v_sheets, v_numbers_per_sheet from public.purchase_order_print_batches
    where company_id = p_company_id and request_id = p_request_id;
  if v_first is null then
    select coalesce(max(order_number), 0) into v_max from public.supplier_purchase_orders where company_id = p_company_id;
    insert into public.purchase_order_print_counters(company_id, last_number) values (p_company_id, v_max + p_sheet_count)
      on conflict (company_id) do update set last_number = greatest(purchase_order_print_counters.last_number, v_max) + p_sheet_count
      returning last_number - p_sheet_count + 1 into v_first;
    insert into public.purchase_order_print_batches(company_id, request_id, first_number, sheet_count, created_by, numbers_per_sheet)
      values (p_company_id, p_request_id, v_first, p_sheet_count, v_uid, 1);
  elsif v_sheets <> p_sheet_count or v_numbers_per_sheet <> 1 then
    raise exception 'Este lote ya fue reservado con otra cantidad de hojas';
  end if;
  return jsonb_build_object('firstNumber', v_first, 'secondNumber', v_first + 1,
    'lastNumber', v_first + p_sheet_count - 1, 'sheetCount', p_sheet_count);
end;
$$;
revoke all on function public.reserve_purchase_order_template_sheets(uuid, uuid, integer) from public, anon;
grant execute on function public.reserve_purchase_order_template_sheets(uuid, uuid, integer) to authenticated;



commit;
