begin;

-- Superadmins can operate active companies without a company membership.
create or replace function public.reserve_purchase_order_print_batch(p_company_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_first bigint;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if p_request_id is null then raise exception 'Falta el identificador de impresión'; end if;
  if not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE')
    or (not public.is_superadmin(v_uid) and not public.is_company_member(v_uid, p_company_id))
    or not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No tenés permiso para imprimir órdenes en esta empresa';
  end if;
  -- Serialize allocation and idempotency checks within this company only.
  perform pg_advisory_xact_lock(hashtextextended('purchase-order-print:' || p_company_id::text, 0));
  select first_number into v_first from public.purchase_order_print_batches
    where company_id = p_company_id and request_id = p_request_id;
  if v_first is null then
    insert into public.purchase_order_print_counters(company_id, last_number) values (p_company_id, 2)
      on conflict (company_id) do update set last_number = purchase_order_print_counters.last_number + 2
      returning last_number - 1 into v_first;
    insert into public.purchase_order_print_batches(company_id, request_id, first_number, created_by)
      values (p_company_id, p_request_id, v_first, v_uid);
  end if;
  return jsonb_build_object('firstNumber', v_first, 'secondNumber', v_first + 1);
end;
$$;
revoke all on function public.reserve_purchase_order_print_batch(uuid, uuid) from public, anon;
grant execute on function public.reserve_purchase_order_print_batch(uuid, uuid) to authenticated;

commit;
