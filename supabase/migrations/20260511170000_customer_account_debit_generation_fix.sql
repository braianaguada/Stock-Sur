create or replace function public.record_customer_account_entry(
  p_company_id uuid,
  p_customer_id uuid,
  p_entry_type public.customer_account_entry_type,
  p_origin_type public.customer_account_origin_type,
  p_origin_id uuid,
  p_amount numeric(14,2),
  p_description text,
  p_business_date date default now()::date,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_document_id uuid default null,
  p_cash_sale_id uuid default null
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_existing public.customer_account_entries%rowtype;
  v_entry public.customer_account_entries%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar movimientos de cuenta corriente';
  end if;

  if not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No perteneces a la empresa del movimiento';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and company_id = p_company_id
  for share;

  if not found then
    raise exception 'Cliente no encontrado en la empresa indicada';
  end if;

  if v_customer.is_occasional then
    raise exception 'El cliente ocasional no puede generar cuenta corriente';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'El importe debe ser mayor a cero';
  end if;

  if p_origin_type = 'DOCUMENT' and p_document_id is null then
    raise exception 'El movimiento desde documento requiere document_id';
  end if;

  if p_origin_type = 'CASH_SALE' and p_cash_sale_id is null then
    raise exception 'El movimiento desde caja requiere cash_sale_id';
  end if;

  if p_origin_type = 'MANUAL' and (p_document_id is not null or p_cash_sale_id is not null) then
    raise exception 'El movimiento manual no puede referenciar otros orígenes';
  end if;

  select *
  into v_existing
  from public.customer_account_entries e
  where e.company_id = p_company_id
    and e.origin_type = p_origin_type
    and e.origin_id = p_origin_id
    and e.entry_type = p_entry_type;

  if found then
    return v_existing;
  end if;

  if p_document_id is not null then
    perform 1
    from public.documents d
    where d.id = p_document_id
      and d.company_id = p_company_id
      and d.customer_id = p_customer_id;
    if not found then
      raise exception 'El documento no pertenece a la empresa o no coincide con el cliente';
    end if;
  end if;

  if p_cash_sale_id is not null then
    perform 1
    from public.cash_sales cs
    where cs.id = p_cash_sale_id
      and cs.company_id = p_company_id
      and cs.customer_id = p_customer_id;
    if not found then
      raise exception 'La venta no pertenece a la empresa o no coincide con el cliente';
    end if;
  end if;

  insert into public.customer_account_entries (
    company_id, customer_id, entry_type, origin_type, origin_id,
    document_id, cash_sale_id, amount, business_date, description,
    notes, metadata, created_by
  )
  values (
    p_company_id, p_customer_id, p_entry_type, p_origin_type, p_origin_id,
    p_document_id, p_cash_sale_id, p_amount, p_business_date, p_description,
    p_notes, coalesce(p_metadata, '{}'::jsonb), v_actor
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.register_customer_account_debit_from_document(
  p_company_id uuid,
  p_customer_id uuid,
  p_document_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.customer_id is null then
    raise exception 'La cuenta corriente requiere un cliente identificado';
  end if;

  if v_doc.customer_id <> p_customer_id then
    raise exception 'El cliente del documento no coincide';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se contemplan remitos en esta etapa';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'DEBIT',
    'DOCUMENT',
    p_document_id,
    coalesce(p_amount, v_doc.total),
    coalesce(p_description, format('Debito por %s', v_doc.doc_type::text)),
    v_doc.issue_date,
    p_notes,
    p_metadata,
    p_document_id,
    null
  );
end;
$$;

create or replace function public.register_customer_account_debit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.cash_sales%rowtype;
begin
  select *
  into v_sale
  from public.cash_sales
  where id = p_cash_sale_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.customer_id is null then
    raise exception 'La cuenta corriente requiere cliente identificado';
  end if;

  if v_sale.customer_id <> p_customer_id then
    raise exception 'El cliente de la venta no coincide';
  end if;

  if v_sale.payment_method <> 'CUENTA_CORRIENTE' then
    raise exception 'Solo se puede debitar desde una venta a cuenta corriente';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'DEBIT',
    'CASH_SALE',
    p_cash_sale_id,
    coalesce(p_amount, v_sale.amount_total),
    coalesce(p_description, 'Venta fiada en caja'),
    v_sale.business_date,
    p_notes,
    p_metadata,
    null,
    p_cash_sale_id
  );
end;
$$;

create or replace function public.register_customer_account_credit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.register_customer_account_debit_from_cash_sale(
    p_company_id,
    p_customer_id,
    p_cash_sale_id,
    p_amount,
    p_description,
    p_notes,
    p_metadata
  );
end;
$$;

create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_now timestamptz := now();
  v_is_eligible boolean := false;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status <> 'BORRADOR' then
    raise exception 'Solo se pueden emitir remitos en borrador';
  end if;

  update public.documents
  set status = 'EMITIDO',
      issued_at = v_now,
      issue_date = v_now at time zone 'America/Argentina/Buenos_Aires'
  where id = p_document_id
  returning * into v_doc;

  select exists (
    select 1
    from public.documents d
    join public.customers c on c.id = d.customer_id
    where d.id = v_doc.id
      and d.doc_type = 'REMITO'
      and d.status = 'EMITIDO'
      and d.customer_id is not null
      and c.is_occasional = false
  ) into v_is_eligible;

  if v_is_eligible then
    perform public.register_customer_account_debit_from_document(
      v_doc.company_id,
      v_doc.customer_id,
      v_doc.id,
      v_doc.total,
      null,
      null,
      jsonb_build_object('source', 'issue_document')
    );
  end if;

  return v_doc;
end;
$$;

create or replace function public.sync_cash_sale_customer_account_debit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_method <> 'CUENTA_CORRIENTE' then
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

drop trigger if exists trg_cash_sales_register_customer_account_debit on public.cash_sales;
create trigger trg_cash_sales_register_customer_account_debit
after insert or update of payment_method, customer_id, amount_total, business_date on public.cash_sales
for each row
execute function public.sync_cash_sale_customer_account_debit();
