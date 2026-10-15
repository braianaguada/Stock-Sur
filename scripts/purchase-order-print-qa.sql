-- Staging only: npx supabase db query --linked --file scripts/purchase-order-print-qa.sql
-- All reservations made by this test are rolled back.
begin;
do $$
declare actor uuid; company uuid; request uuid := gen_random_uuid(); first_batch jsonb; retry_batch jsonb; next_batch jsonb;
begin
  if has_function_privilege('anon', 'public.reserve_purchase_order_print_batch(uuid,uuid)', 'execute') then raise exception 'Anonymous execute granted'; end if;
  if has_table_privilege('authenticated', 'public.purchase_order_print_counters', 'UPDATE') then raise exception 'Direct counter writes granted'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.reserve_purchase_order_print_batch(gen_random_uuid(),request);
    raise exception 'Anonymous accepted';
  exception when raise_exception then
    if sqlerrm <> 'Necesitás iniciar sesión' then raise; end if;
  end;
  select cu.user_id,cu.company_id into actor,company from public.company_users cu
  join public.companies c on c.id=cu.company_id and c.status='ACTIVE'
  where public.is_company_member(cu.user_id,cu.company_id) and public.has_company_permission(cu.user_id,cu.company_id,'suppliers.edit') limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  begin
    perform public.reserve_purchase_order_print_batch(gen_random_uuid(),request);
    raise exception 'Foreign company accepted';
  exception when raise_exception then
    if sqlerrm <> 'No tenés permiso para imprimir órdenes en esta empresa' then raise; end if;
  end;
  first_batch := public.reserve_purchase_order_print_batch(company,request);
  retry_batch := public.reserve_purchase_order_print_batch(company,request);
  next_batch := public.reserve_purchase_order_print_batch(company,gen_random_uuid());
  if first_batch <> retry_batch then raise exception 'Retry allocated new numbers'; end if;
  if (first_batch->>'secondNumber')::bigint <> (first_batch->>'firstNumber')::bigint + 1 then raise exception 'Non-consecutive sheet'; end if;
  if (next_batch->>'firstNumber')::bigint <> (first_batch->>'firstNumber')::bigint + 2 then raise exception 'Invalid next allocation'; end if;
end $$;
rollback;
