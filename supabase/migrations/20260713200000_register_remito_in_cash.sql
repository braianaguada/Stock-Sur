do $$
begin
  if exists (
    select 1
    from public.cash_sales
    where status <> 'ANULADA'
      and nullif(btrim(coalesce(receipt_reference, '')), '') is not null
    group by company_id, btrim(receipt_reference)
    having count(*) > 1
  ) then
    raise exception 'No se puede asegurar unicidad: existen comprobantes activos duplicados en caja';
  end if;
end;
$$;

create unique index if not exists cash_sales_unique_active_receipt_reference_idx
  on public.cash_sales(company_id, btrim(receipt_reference))
  where status <> 'ANULADA'
    and nullif(btrim(coalesce(receipt_reference, '')), '') is not null;

create or replace function public.sync_cash_sale_customer_account_debit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
begin
  if new.payment_method <> 'CUENTA_CORRIENTE' then
    return new;
  end if;

  v_document_id := new.document_id;

  if v_document_id is null and new.receipt_kind = 'FACTURA' then
    select d.id
    into v_document_id
    from public.documents d
    where d.company_id = new.company_id
      and d.doc_type = 'REMITO'
      and d.external_invoice_status = 'ACTIVE'
      and d.external_invoice_number = btrim(new.receipt_reference)
    order by d.issue_date desc, d.created_at desc
    limit 1;
  end if;

  if v_document_id is not null and exists (
    select 1
    from public.customer_account_entries e
    where e.company_id = new.company_id
      and e.customer_id = new.customer_id
      and e.entry_type = 'DEBIT'
      and e.origin_type = 'DOCUMENT'
      and e.document_id = v_document_id
  ) then
    return new;
  end if;

  perform public.register_customer_account_debit_from_cash_sale(
    new.company_id,
    new.customer_id,
    new.id,
    new.amount_total,
    'Venta fiada en caja',
    null,
    jsonb_build_object('source', 'cash_sales_trigger')
  );

  return new;
end;
$$;

create or replace function public.register_cash_sale_from_remito(
  p_company_id uuid,
  p_document_id uuid,
  p_payment_method public.cash_payment_method
)
returns public.cash_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_existing public.cash_sales%rowtype;
  v_sale public.cash_sales%rowtype;
  v_business_date date;
  v_receipt_kind public.cash_receipt_kind;
  v_reference text;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar la venta';
  end if;

  if not public.has_company_permission(v_actor, p_company_id, 'cash.create') then
    raise exception 'No tienes permiso para registrar ventas en caja';
  end if;

  if p_payment_method not in (
    'EFECTIVO',
    'EFECTIVO_REMITO',
    'EFECTIVO_FACTURABLE',
    'SERVICIOS_REMITO',
    'POINT',
    'TRANSFERENCIA',
    'CUENTA_CORRIENTE'
  ) then
    raise exception 'Medio de pago no admitido';
  end if;

  select *
  into v_doc
  from public.documents
  where id = p_document_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Remito no encontrado en la empresa activa';
  end if;

  if v_doc.doc_type <> 'REMITO' or v_doc.status <> 'EMITIDO' then
    raise exception 'Solo se puede registrar un remito emitido';
  end if;

  if coalesce(v_doc.total, 0) <= 0 then
    raise exception 'El remito debe tener un total mayor a cero';
  end if;

  if p_payment_method = 'CUENTA_CORRIENTE' and v_doc.customer_id is null then
    raise exception 'La cuenta corriente requiere un cliente identificado';
  end if;

  v_business_date := coalesce(
    v_doc.issue_date,
    (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date
  );

  if v_doc.external_invoice_status = 'ACTIVE'
     and nullif(btrim(coalesce(v_doc.external_invoice_number, '')), '') is not null then
    v_receipt_kind := 'FACTURA';
    v_reference := btrim(v_doc.external_invoice_number);
  else
    v_receipt_kind := 'REMITO';
    v_reference := format(
      '%s-%s',
      lpad(v_doc.point_of_sale::text, 4, '0'),
      lpad(v_doc.document_number::text, 8, '0')
    );
  end if;

  select *
  into v_existing
  from public.cash_sales cs
  where cs.company_id = p_company_id
    and cs.status <> 'ANULADA'
    and (
      cs.document_id = v_doc.id
      or (
        nullif(btrim(coalesce(cs.receipt_reference, '')), '') is not null
        and btrim(cs.receipt_reference) = v_reference
      )
    )
  order by cs.created_at
  limit 1
  for update;

  if found then
    if v_existing.payment_method <> p_payment_method then
      raise exception 'El remito ya fue registrado en caja con otro medio de pago';
    end if;
    return v_existing;
  end if;

  insert into public.cash_sales (
    company_id,
    business_date,
    sold_at,
    customer_id,
    customer_name_snapshot,
    payment_method,
    receipt_kind,
    status,
    document_id,
    receipt_reference,
    amount_total,
    closure_id,
    created_by
  ) values (
    p_company_id,
    v_business_date,
    now(),
    v_doc.customer_id,
    coalesce(nullif(btrim(v_doc.customer_name), ''), 'Consumidor final'),
    p_payment_method,
    v_receipt_kind,
    'COMPROBANTADA',
    case when v_receipt_kind = 'REMITO' then v_doc.id else null end,
    v_reference,
    v_doc.total,
    null,
    v_actor
  )
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.register_cash_sale_from_remito(uuid, uuid, public.cash_payment_method) from public;
revoke all on function public.register_cash_sale_from_remito(uuid, uuid, public.cash_payment_method) from anon;
grant execute on function public.register_cash_sale_from_remito(uuid, uuid, public.cash_payment_method) to authenticated;
