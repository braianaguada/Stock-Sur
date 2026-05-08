create or replace function public.duplicate_document(
  p_document_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.documents%rowtype;
  v_duplicate public.documents%rowtype;
  v_source_number text;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para duplicar documentos';
  end if;

  select * into v_source
  from public.documents
  where id = p_document_id
  for share;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_source.company_id, 'documents.create') then
    raise exception 'No tienes permisos para crear documentos';
  end if;

  if v_source.doc_type not in ('PRESUPUESTO', 'REMITO') then
    raise exception 'Solo se pueden duplicar presupuestos y remitos';
  end if;

  if v_source.document_number is not null then
    v_source_number := format(
      '%s-%s',
      lpad(v_source.point_of_sale::text, 4, '0'),
      lpad(v_source.document_number::text, 8, '0')
    );
  end if;

  insert into public.documents (
    company_id,
    doc_type,
    status,
    point_of_sale,
    document_number,
    issue_date,
    customer_id,
    technician_id,
    origin_document_id,
    customer_name,
    customer_tax_condition,
    customer_tax_id,
    customer_kind,
    internal_remito_type,
    payment_terms,
    delivery_address,
    salesperson,
    valid_until,
    price_list_id,
    source_document_id,
    source_document_type,
    source_document_number_snapshot,
    notes,
    subtotal,
    discount_total,
    tax_total,
    total,
    created_by
  )
  values (
    v_source.company_id,
    v_source.doc_type,
    'BORRADOR',
    v_source.point_of_sale,
    null,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date,
    v_source.customer_id,
    v_source.technician_id,
    null,
    v_source.customer_name,
    v_source.customer_tax_condition,
    v_source.customer_tax_id,
    v_source.customer_kind,
    v_source.internal_remito_type,
    v_source.payment_terms,
    v_source.delivery_address,
    v_source.salesperson,
    case when v_source.doc_type = 'PRESUPUESTO' then v_source.valid_until else null end,
    v_source.price_list_id,
    v_source.id,
    v_source.doc_type,
    v_source_number,
    v_source.notes,
    v_source.subtotal,
    v_source.discount_total,
    v_source.tax_total,
    v_source.total,
    v_actor
  )
  returning * into v_duplicate;

  insert into public.document_lines (
    document_id,
    line_order,
    item_id,
    sku_snapshot,
    description,
    unit,
    quantity,
    unit_price,
    discount_pct,
    tax_pct,
    pricing_mode,
    suggested_unit_price,
    base_cost_snapshot,
    list_flete_pct_snapshot,
    list_utilidad_pct_snapshot,
    list_impuesto_pct_snapshot,
    manual_margin_pct,
    price_overridden_by,
    price_overridden_at,
    line_total,
    created_by
  )
  select
    v_duplicate.id,
    line_order,
    item_id,
    sku_snapshot,
    description,
    unit,
    quantity,
    unit_price,
    discount_pct,
    tax_pct,
    pricing_mode,
    suggested_unit_price,
    base_cost_snapshot,
    list_flete_pct_snapshot,
    list_utilidad_pct_snapshot,
    list_impuesto_pct_snapshot,
    manual_margin_pct,
    price_overridden_by,
    price_overridden_at,
    line_total,
    v_actor
  from public.document_lines
  where document_id = v_source.id
  order by line_order;

  insert into public.document_events (
    document_id,
    event_type,
    payload,
    created_by
  )
  values (
    v_duplicate.id,
    'DUPLICATED_FROM_DOCUMENT',
    jsonb_build_object(
      'source_document_id', v_source.id,
      'source_doc_type', v_source.doc_type,
      'source_number', v_source_number
    ),
    v_actor
  );

  return v_duplicate;
end;
$$;
