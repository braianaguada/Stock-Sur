create or replace function public.validate_cash_sale_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_doc_business_date date;
begin
  if new.status = 'ANULADA' then
    return new;
  end if;

  if new.document_id is not null then
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
  elsif new.receipt_kind = 'FACTURA' then
    if nullif(btrim(coalesce(new.receipt_reference, '')), '') is null then
      raise exception 'La factura requiere numero de comprobante';
    end if;

    select *
    into v_doc
    from public.documents
    where company_id = new.company_id
      and doc_type = 'REMITO'
      and external_invoice_status = 'ACTIVE'
      and external_invoice_number = btrim(new.receipt_reference)
    order by issue_date desc, created_at desc
    limit 1;

    if not found then
      raise exception 'No se encontro un remito facturado para ese numero';
    end if;

    v_doc_business_date := coalesce(
      v_doc.issue_date,
      (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date
    );

    if new.business_date <> v_doc_business_date then
      raise exception 'La fecha de la venta debe coincidir con la fecha de la factura asociada';
    end if;

    if new.customer_id is null and v_doc.customer_id is not null then
      new.customer_id := v_doc.customer_id;
    end if;

    if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
      new.customer_name_snapshot := coalesce(v_doc.customer_name, new.customer_name_snapshot);
    end if;
  else
    return new;
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
