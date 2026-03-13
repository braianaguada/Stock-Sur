create unique index if not exists cash_sales_unique_active_document_idx
  on public.cash_sales(document_id)
  where document_id is not null and status <> 'ANULADA';

create or replace function public.validate_cash_sale_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
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

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede asociar un remito a la venta';
  end if;

  if v_doc.status = 'ANULADO' then
    raise exception 'No se puede asociar un remito anulado';
  end if;

  if new.receipt_kind <> 'REMITO' then
    raise exception 'El documento asociado exige comprobante tipo remito';
  end if;

  if new.business_date <> v_doc.issue_date then
    raise exception 'La fecha de la venta debe coincidir con la fecha del remito asociado';
  end if;

  if exists (
    select 1
    from public.cash_sales s
    where s.document_id = new.document_id
      and s.status <> 'ANULADA'
      and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'Ese remito ya esta asociado a otra venta';
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

  if new.customer_id is null and v_doc.customer_id is not null then
    new.customer_id := v_doc.customer_id;
  end if;

  if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
    new.customer_name_snapshot := coalesce(v_doc.customer_name, new.customer_name_snapshot);
  end if;

  return new;
end;
$$;
