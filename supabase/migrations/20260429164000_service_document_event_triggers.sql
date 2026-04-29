create or replace function public.log_service_document_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_event_type text;
begin
  if current_setting('service.service_document_event_mode', true) = 'skip' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_event_type := 'CREATED';
  elsif tg_op = 'UPDATE' then
    if old.status = 'DRAFT' then
      v_event_type := 'UPDATED';
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.service_document_events (
    document_id,
    event_type,
    payload,
    created_by
  ) values (
    new.id,
    v_event_type,
    jsonb_build_object(
      'status', new.status,
      'subtotal', new.subtotal,
      'total', new.total
    ),
    coalesce(new.created_by, v_actor)
  );

  return new;
end;
$$;

drop trigger if exists service_document_event_logger on public.service_documents;
create trigger service_document_event_logger
after insert or update on public.service_documents
for each row execute function public.log_service_document_event();

create or replace function public.create_service_document_copy(
  p_source_document_id uuid,
  p_target_type public.service_document_type
)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.service_documents%rowtype;
  v_new_doc public.service_documents%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para crear documentos de servicio';
  end if;

  select * into v_source
  from public.service_documents
  where id = p_source_document_id;

  if not found then
    raise exception 'Documento de servicio no encontrado';
  end if;

  if not public.is_company_member(v_actor, v_source.company_id)
     or not public.has_company_permission(v_actor, v_source.company_id, 'documents.create') then
    raise exception 'No tienes permisos para crear documentos de servicio';
  end if;

  perform set_config('service.service_document_event_mode', 'skip', true);

  insert into public.service_documents (
    company_id,
    customer_id,
    type,
    status,
    reference,
    issue_date,
    valid_until,
    delivery_time,
    payment_terms,
    delivery_location,
    intro_text,
    closing_text,
    subtotal,
    total,
    currency,
    created_by
  ) values (
    v_source.company_id,
    v_source.customer_id,
    p_target_type,
    'DRAFT',
    v_source.reference,
    current_date,
    null,
    v_source.delivery_time,
    v_source.payment_terms,
    v_source.delivery_location,
    v_source.intro_text,
    v_source.closing_text,
    v_source.subtotal,
    v_source.total,
    v_source.currency,
    v_actor
  )
  returning * into v_new_doc;

  insert into public.service_document_lines (
    document_id,
    description,
    quantity,
    unit,
    unit_price,
    line_total,
    sort_order
  )
  select
    v_new_doc.id,
    l.description,
    l.quantity,
    l.unit,
    l.unit_price,
    l.line_total,
    l.sort_order
  from public.service_document_lines l
  where l.document_id = v_source.id
  order by l.sort_order;

  insert into public.service_document_events (
    document_id,
    event_type,
    payload,
    created_by
  ) values (
    v_new_doc.id,
    case when p_target_type = 'REMITO' then 'CONVERTED_TO_REMITO' else 'DUPLICATED' end,
    jsonb_build_object('source_document_id', v_source.id),
    v_actor
  );

  return v_new_doc;
end;
$$;

grant execute on function public.create_service_document_copy(uuid, public.service_document_type) to authenticated;

create or replace function public.save_service_document(
  p_document_id uuid,
  p_company_id uuid,
  p_customer_id uuid,
  p_status public.service_document_status,
  p_reference text,
  p_issue_date date,
  p_valid_until date,
  p_delivery_time text,
  p_payment_terms text,
  p_delivery_location text,
  p_intro_text text,
  p_closing_text text,
  p_currency text,
  p_lines jsonb
)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.service_documents%rowtype;
  v_total numeric(14,2) := 0;
  v_lines_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para guardar documentos de servicio';
  end if;

  if p_document_id is null then
    if not public.is_company_member(v_actor, p_company_id)
       or not public.has_company_permission(v_actor, p_company_id, 'documents.create') then
      raise exception 'No tienes permisos para crear documentos de servicio';
    end if;

    insert into public.service_documents (
      company_id,
      customer_id,
      type,
      status,
      reference,
      issue_date,
      valid_until,
      delivery_time,
      payment_terms,
      delivery_location,
      intro_text,
      closing_text,
      subtotal,
      total,
      currency,
      created_by
    ) values (
      p_company_id,
      p_customer_id,
      'QUOTE',
      p_status,
      p_reference,
      p_issue_date,
      p_valid_until,
      p_delivery_time,
      p_payment_terms,
      p_delivery_location,
      p_intro_text,
      p_closing_text,
      0,
      0,
      coalesce(p_currency, 'ARS'),
      v_actor
    )
    returning * into v_doc;
  else
    if not exists (
      select 1
      from public.service_documents d
      where d.id = p_document_id
        and d.company_id = p_company_id
        and public.is_company_member(v_actor, d.company_id)
        and public.has_company_permission(v_actor, d.company_id, 'documents.edit')
    ) then
      raise exception 'No tienes permisos para editar documentos de servicio';
    end if;

    update public.service_documents
    set
      customer_id = p_customer_id,
      status = p_status,
      reference = p_reference,
      issue_date = p_issue_date,
      valid_until = p_valid_until,
      delivery_time = p_delivery_time,
      payment_terms = p_payment_terms,
      delivery_location = p_delivery_location,
      intro_text = p_intro_text,
      closing_text = p_closing_text,
      currency = coalesce(p_currency, currency),
      updated_at = now()
    where id = p_document_id
      and status = 'DRAFT'
    returning * into v_doc;

    if not found then
      raise exception 'Documento de servicio no encontrado o no editable';
    end if;

    delete from public.service_document_lines where document_id = v_doc.id;
  end if;

  insert into public.service_document_lines (
    document_id,
    description,
    quantity,
    unit,
    unit_price,
    line_total,
    sort_order
  )
  select
    v_doc.id,
    trim(coalesce(line_item->>'description', '')),
    nullif(line_item->>'quantity', '')::numeric,
    nullif(line_item->>'unit', ''),
    nullif(line_item->>'unit_price', '')::numeric,
    coalesce(nullif(line_item->>'line_total', '')::numeric, 0),
    row_number() over ()
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as line_item(value, ord)
  where trim(coalesce(line_item.value->>'description', '')) <> ''
  order by line_item.ord;

  select coalesce(sum(line_total), 0), count(*)
  into v_total, v_lines_count
  from public.service_document_lines
  where document_id = v_doc.id;

  update public.service_documents
  set subtotal = v_total,
      total = v_total
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$$;

grant execute on function public.save_service_document(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb) to authenticated;
