begin;

alter table public.purchase_order_print_batches
  add column sheet_count integer not null default 1 check (sheet_count between 1 and 100);

create function public.reserve_purchase_order_print_sheets(p_company_id uuid, p_request_id uuid, p_sheet_count integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first bigint;
  v_sheets integer;
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
    insert into public.purchase_order_print_counters(company_id, last_number) values (p_company_id, p_sheet_count * 2)
      on conflict (company_id) do update set last_number = purchase_order_print_counters.last_number + p_sheet_count * 2
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

-- Keep older clients compatible and use the same lock/counter for both APIs.
create or replace function public.reserve_purchase_order_print_batch(p_company_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_batch jsonb;
begin
  v_batch := public.reserve_purchase_order_print_sheets(p_company_id, p_request_id, 1);
  return jsonb_build_object('firstNumber', v_batch->'firstNumber', 'secondNumber', v_batch->'secondNumber');
end;
$$;

commit;
