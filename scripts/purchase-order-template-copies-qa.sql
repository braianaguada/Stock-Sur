-- Staging only: npx supabase db query --linked --file scripts/purchase-order-template-copies-qa.sql
-- Reservations are temporary and all counter changes are rolled back.
begin;
do $$
declare
  actor uuid; company uuid; request uuid := gen_random_uuid();
  first_batch jsonb; retry_batch jsonb; next_batch jsonb; legacy_batch jsonb;
begin
  if has_function_privilege('anon', 'public.reserve_purchase_order_template_sheets(uuid,uuid,integer)', 'execute') then
    raise exception 'Anonymous execute granted';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.reserve_purchase_order_template_sheets(gen_random_uuid(), request, 3);
    raise exception 'Anonymous accepted';
  exception when raise_exception then
    if sqlerrm <> 'Necesitás iniciar sesión' then raise; end if;
  end;
  select cu.user_id, cu.company_id into actor, company from public.company_users cu
    join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
    where public.is_company_member(cu.user_id, cu.company_id)
      and public.has_company_permission(cu.user_id, cu.company_id, 'suppliers.edit') limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  begin
    perform public.reserve_purchase_order_template_sheets(gen_random_uuid(), request, 3);
    raise exception 'Foreign company accepted';
  exception when raise_exception then
    if sqlerrm <> 'No tenés permiso para imprimir órdenes en esta empresa' then raise; end if;
  end;
  first_batch := public.reserve_purchase_order_template_sheets(company, request, 3);
  retry_batch := public.reserve_purchase_order_template_sheets(company, request, 3);
  if first_batch <> retry_batch then raise exception 'Retry allocated new numbers'; end if;
  if (first_batch->>'lastNumber')::bigint <> (first_batch->>'firstNumber')::bigint + 2 then
    raise exception 'Three sheets must reserve three numbers';
  end if;
  begin
    perform public.reserve_purchase_order_template_sheets(company, request, 2);
    raise exception 'Mismatched retry accepted';
  exception when raise_exception then
    if sqlerrm <> 'Este lote ya fue reservado con otra cantidad de hojas' then raise; end if;
  end;
  legacy_batch := public.reserve_purchase_order_print_sheets(company, gen_random_uuid(), 1);
  next_batch := public.reserve_purchase_order_template_sheets(company, gen_random_uuid(), 1);
  if (legacy_batch->>'firstNumber')::bigint <> (first_batch->>'lastNumber')::bigint + 1
    or (next_batch->>'firstNumber')::bigint <> (legacy_batch->>'lastNumber')::bigint + 1
    or next_batch->>'firstNumber' <> next_batch->>'lastNumber' then
    raise exception 'Shared counter continuity failed';
  end if;
end $$;
rollback;
