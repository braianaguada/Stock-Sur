create or replace function public.validate_cash_sale_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_doc_business_date date;
begin
  if new.document_id is null then
    return new;
  end if;

  select *
  into v_doc
  from public.documents
  where id = new.document_id;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  v_doc_business_date := coalesce(
    v_doc.issue_date,
    (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date
  );

  if v_doc.company_id <> new.company_id then
    raise exception 'La venta y el remito asociado deben pertenecer a la misma empresa';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede asociar un remito a la venta';
  end if;

  if v_doc.status = 'ANULADO' then
    raise exception 'No se puede asociar un remito anulado';
  end if;

  if new.receipt_kind <> 'REMITO' then
    raise exception 'El documento asociado exige comprobante tipo remito';
  end if;

  if new.business_date <> v_doc_business_date then
    raise exception 'La fecha de la venta debe coincidir con la fecha del remito asociado';
  end if;

  if coalesce(new.customer_id, '00000000-0000-0000-0000-000000000000'::uuid) <>
     coalesce(v_doc.customer_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    if new.customer_id is not null and v_doc.customer_id is not null then
      raise exception 'La venta y el remito asociado deben pertenecer al mismo cliente';
    end if;
  end if;

  if nullif(btrim(coalesce(new.receipt_reference, '')), '') is null and v_doc.document_number is not null then
    new.receipt_reference := format(
      '%s-%s',
      lpad(v_doc.point_of_sale::text, 4, '0'),
      lpad(v_doc.document_number::text, 8, '0')
    );
  end if;

  if nullif(btrim(coalesce(new.receipt_reference, '')), '') is not null then
    perform 1
    from public.cash_sales
    where company_id = new.company_id
      and status <> 'ANULADA'
      and receipt_reference = btrim(new.receipt_reference)
      and id <> new.id;

    if found then
      raise exception 'Ese comprobante ya fue registrado en caja';
    end if;
  end if;

  if new.customer_id is null and v_doc.customer_id is not null then
    new.customer_id := v_doc.customer_id;
  end if;

  if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
    new.customer_name_snapshot := coalesce(v_doc.customer_name, new.customer_name_snapshot);
  end if;

  return new;
end;
$$;

create or replace function public.attach_cash_sale_receipt(
  p_sale_id uuid,
  p_receipt_kind public.cash_receipt_kind,
  p_document_id uuid default null,
  p_receipt_reference text default null
)
returns public.cash_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_sale public.cash_sales%rowtype;
  v_receipt_reference text := nullif(btrim(coalesce(p_receipt_reference, '')), '');
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para asociar comprobantes';
  end if;

  select *
  into v_sale
  from public.cash_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if not public.has_company_permission(v_actor, v_sale.company_id, 'cash.edit') then
    raise exception 'No tienes permisos para asociar comprobantes';
  end if;

  if v_sale.status = 'ANULADA' then
    raise exception 'No se puede asociar comprobante a una venta anulada';
  end if;

  if v_receipt_reference is not null then
    perform 1
    from public.cash_sales
    where company_id = v_sale.company_id
      and status <> 'ANULADA'
      and receipt_reference = v_receipt_reference
      and id <> p_sale_id;

    if found then
      raise exception 'Ese comprobante ya fue registrado en caja';
    end if;
  end if;

  update public.cash_sales
  set
    receipt_kind = p_receipt_kind,
    document_id = p_document_id,
    receipt_reference = v_receipt_reference
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;
