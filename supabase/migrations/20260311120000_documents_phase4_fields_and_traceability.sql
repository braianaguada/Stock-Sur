alter table public.documents
  add column if not exists valid_until date null,
  add column if not exists payment_terms text null,
  add column if not exists delivery_address text null,
  add column if not exists salesperson text null,
  add column if not exists tax_total numeric(14,2) not null default 0,
  add column if not exists source_document_type public.document_type null,
  add column if not exists source_document_number_snapshot text null;

alter table public.document_lines
  add column if not exists tax_pct numeric(8,4) not null default 0;

update public.documents d
set
  source_document_type = src.doc_type,
  source_document_number_snapshot = format(
    '%s-%s',
    lpad(src.point_of_sale::text, 4, '0'),
    lpad(coalesce(src.document_number, 0)::text, 8, '0')
  )
from public.documents src
where d.source_document_id = src.id
  and (d.source_document_type is null or d.source_document_number_snapshot is null)
  and src.document_number is not null;

create index if not exists documents_valid_until_idx
  on public.documents(valid_until)
  where valid_until is not null;

alter table public.documents
  drop constraint if exists documents_source_document_type_check;

alter table public.documents
  add constraint documents_source_document_type_check
  check (
    source_document_type is null
    or source_document_id is not null
  );

create or replace function public.transition_document_status(
  p_document_id uuid,
  p_target_status public.document_status
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_updated public.documents%rowtype;
  v_ref text;
  v_next integer;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status = p_target_status then
    return v_doc;
  end if;

  if v_doc.doc_type = 'PRESUPUESTO' then
    if p_target_status not in ('ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Estado invalido para presupuesto';
    end if;

    if v_doc.status = 'BORRADOR' and p_target_status not in ('ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Transicion invalida';
    end if;

    if v_doc.status = 'ENVIADO' and p_target_status not in ('APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Transicion invalida';
    end if;

    if v_doc.status = 'APROBADO' and p_target_status <> 'ANULADO' then
      raise exception 'Un presupuesto aprobado solo puede anularse';
    end if;

    if v_doc.status in ('RECHAZADO', 'ANULADO', 'EMITIDO') then
      raise exception 'El presupuesto ya no admite cambios de estado';
    end if;
  elsif v_doc.doc_type = 'REMITO' then
    if p_target_status <> 'ANULADO' then
      raise exception 'El remito solo puede anularse por esta via';
    end if;

    if v_doc.status not in ('BORRADOR', 'EMITIDO') then
      raise exception 'El remito no puede anularse en su estado actual';
    end if;
  else
    raise exception 'Tipo de documento no soportado';
  end if;

  if v_doc.doc_type = 'PRESUPUESTO'
     and v_doc.status = 'BORRADOR'
     and v_doc.document_number is null
     and p_target_status <> 'ANULADO' then
    insert into public.document_sequences (doc_type, point_of_sale, last_number)
    values (v_doc.doc_type, v_doc.point_of_sale, 0)
    on conflict (doc_type, point_of_sale) do nothing;

    update public.document_sequences
    set last_number = last_number + 1, updated_at = now()
    where doc_type = v_doc.doc_type and point_of_sale = v_doc.point_of_sale
    returning last_number into v_next;
  end if;

  update public.documents
  set status = p_target_status,
      document_number = coalesce(v_next, document_number),
      external_invoice_number = case when p_target_status = 'ANULADO' then null else external_invoice_number end,
      external_invoice_date = case when p_target_status = 'ANULADO' then null else external_invoice_date end,
      external_invoice_status = case when p_target_status = 'ANULADO' then 'VOIDED'::public.external_invoice_status else external_invoice_status end,
      external_invoice_updated_at = case when p_target_status = 'ANULADO' then now() else external_invoice_updated_at end,
      external_invoice_updated_by = case when p_target_status = 'ANULADO' then auth.uid() else external_invoice_updated_by end,
      updated_at = now()
  where id = v_doc.id
  returning * into v_updated;

  if v_doc.doc_type = 'REMITO' and v_doc.status = 'EMITIDO' and p_target_status = 'ANULADO' then
    v_ref := format(
      'ANULACION %s %s',
      v_doc.doc_type::text,
      format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0'))
    );

    insert into public.stock_movements (item_id, type, quantity, reference, notes, created_by)
    select
      dl.item_id,
      'IN'::public.movement_type,
      dl.quantity,
      v_ref,
      'Ingreso automatico por anulacion de remito',
      auth.uid()
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'STATUS_CHANGED',
    jsonb_build_object(
      'from', v_doc.status,
      'to', p_target_status,
      'document_number', coalesce(v_updated.document_number, v_doc.document_number)
    ),
    auth.uid()
  );

  return v_updated;
end;
$$;
