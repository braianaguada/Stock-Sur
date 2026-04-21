create or replace function public.register_customer_account_credit_manual(
  p_company_id uuid,
  p_customer_id uuid,
  p_amount numeric(14,2),
  p_description text default 'Cobro manual de cuenta corriente',
  p_business_date date default now()::date,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_customer public.customers%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar un cobro';
  end if;

  if not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No perteneces a la empresa del cobro';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and company_id = p_company_id
  for share;

  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  if v_customer.is_occasional then
    raise exception 'El cliente ocasional no puede usar cuenta corriente';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'El importe debe ser mayor a cero';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'CREDIT',
    'MANUAL',
    gen_random_uuid(),
    p_amount,
    p_description,
    p_business_date,
    p_notes,
    coalesce(
      p_metadata,
      jsonb_build_object(
        'kind', 'manual_credit',
        'receipt_kind', 'manual',
        'source', 'customers_account_dialog'
      )
    ),
    null,
    null
  );
end;
$$;
