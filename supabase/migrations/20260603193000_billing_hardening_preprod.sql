create or replace function public.reset_stale_billing_authorization(
  p_billing_document_id uuid
)
returns public.billing_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.billing_documents%rowtype;
  v_reset_doc public.billing_documents%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para liberar una autorizacion trabada';
  end if;

  select *
  into v_doc
  from public.billing_documents
  where id = p_billing_document_id
  for update;

  if not found then
    raise exception 'Comprobante fiscal no encontrado';
  end if;

  if not public.is_company_member(v_actor, v_doc.company_id)
     or not public.has_company_permission(v_actor, v_doc.company_id, 'billing.authorize') then
    raise exception 'No tienes permisos para liberar autorizaciones fiscales';
  end if;

  if v_doc.fiscal_status = 'AUTHORIZED' or v_doc.cae is not null or v_doc.voucher_number is not null then
    raise exception 'No se puede liberar un comprobante autorizado o con CAE/numero fiscal';
  end if;

  if v_doc.fiscal_status <> 'AUTHORIZING' then
    raise exception 'Solo se puede liberar un comprobante en AUTHORIZING';
  end if;

  if v_doc.updated_at > now() - interval '10 minutes' then
    raise exception 'La autorizacion esta en proceso. Espera unos minutos.';
  end if;

  update public.billing_documents
  set
    fiscal_status = 'DRAFT',
    error_message = 'Autorizacion trabada liberada para reintento controlado.',
    provider_errors = coalesce(provider_errors, '[]'::jsonb),
    provider_observations = coalesce(provider_observations, '[]'::jsonb),
    updated_at = now()
  where id = v_doc.id
    and fiscal_status = 'AUTHORIZING'
    and cae is null
    and voucher_number is null
  returning * into v_reset_doc;

  if not found then
    raise exception 'No se pudo liberar la autorizacion trabada';
  end if;

  insert into public.billing_events (
    company_id,
    billing_document_id,
    event_type,
    payload,
    created_by
  )
  values (
    v_doc.company_id,
    v_doc.id,
    'AUTHORIZATION_RESET',
    jsonb_build_object(
      'from_status', 'AUTHORIZING',
      'to_status', 'DRAFT',
      'reason', 'stale_authorizing',
      'stale_minutes', extract(epoch from (now() - v_doc.updated_at)) / 60,
      'stock_mutation', false,
      'cash_mutation', false,
      'customer_account_mutation', false
    ),
    v_actor
  );

  return v_reset_doc;
end;
$$;

grant execute on function public.reset_stale_billing_authorization(uuid) to authenticated;
