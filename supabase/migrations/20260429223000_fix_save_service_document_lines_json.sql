drop function if exists public.save_service_document(
  uuid,
  uuid,
  uuid,
  public.service_document_status,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

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
    trim(coalesce(line_item.value->>'description', '')),
    nullif(line_item.value->>'quantity', '')::numeric,
    nullif(line_item.value->>'unit', ''),
    nullif(line_item.value->>'unit_price', '')::numeric,
    coalesce(nullif(line_item.value->>'line_total', '')::numeric, 0),
    line_item.ord::integer
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as line_item(value, ord)
  where trim(coalesce(line_item.value->>'description', '')) <> ''
  order by line_item.ord;

  select coalesce(sum(line_total), 0)
  into v_total
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

grant execute on function public.save_service_document(
  uuid,
  uuid,
  uuid,
  public.service_document_status,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
