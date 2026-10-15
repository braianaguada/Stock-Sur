-- Staging, non-writing assertions with rollback: npx supabase db query --linked --file scripts/customer-account-payments-qa.sql
begin;
do $$
declare actor uuid; company uuid;
begin
  if has_function_privilege('anon', 'public.register_customer_account_credit_manual(uuid,uuid,numeric,text,date,text,jsonb)', 'execute') then raise exception 'Anonymous execute granted'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.register_customer_account_credit_manual(gen_random_uuid(), gen_random_uuid(), 1);
    raise exception 'Anonymous accepted';
  exception when raise_exception then
    if sqlerrm <> 'Debes iniciar sesion para registrar un cobro' then raise; end if;
  end;
  select cu.user_id,cu.company_id into actor,company from public.company_users cu
  where public.is_company_member(cu.user_id,cu.company_id) and public.has_company_permission(cu.user_id,cu.company_id,'customers.edit') limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  begin
    perform public.register_customer_account_credit_manual(gen_random_uuid(),gen_random_uuid(),1);
    raise exception 'Foreign company accepted';
  exception when raise_exception then
    if sqlerrm <> 'No perteneces a la empresa del cobro' then raise; end if;
  end;
  begin
    perform public.register_customer_account_credit_manual(company,gen_random_uuid(),1);
    raise exception 'Foreign customer accepted';
  exception when raise_exception then
    if sqlerrm <> 'Cliente no encontrado' then raise; end if;
  end;
end $$;
rollback;
