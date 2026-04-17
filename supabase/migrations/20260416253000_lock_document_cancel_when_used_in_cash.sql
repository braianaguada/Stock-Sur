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
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_updated public.documents%rowtype;
  v_ref text;
  v_next integer;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para cambiar el estado de documentos';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if not (
    (p_target_status in ('ENVIADO', 'APROBADO', 'RECHAZADO') and public.has_company_permission(v_actor, v_doc.company_id, 'documents.approve'))
    or (p_target_status = 'ANULADO' and public.has_company_permission(v_actor, v_doc.company_id, 'documents.cancel'))
  ) then
    raise exception 'No tienes permisos para cambiar el estado de documentos';
  end if;

  if v_doc.status = p_target_status then
    return v_doc;
  end if;

  if p_target_status = 'ANULADO' then
    perform 1
    from public.cash_sales
    where company_id = v_doc.company_id
      and status <> 'ANULADA'
      and (
        (document_id is not null and document_id = v_doc.id)
        or (
          v_doc.external_invoice_status = 'ACTIVE'
          and receipt_reference = v_doc.external_invoice_number
        )
      )
    limit 1;

    if found then
      raise exception 'No se puede anular un documento ya usado en caja';
    end if;
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
    insert into public.document_sequences (company_id, doc_type, point_of_sale, last_number)
    values (v_doc.company_id, v_doc.doc_type, v_doc.point_of_sale, 0)
    on conflict (company_id, doc_type, point_of_sale) do nothing;

    update public.document_sequences
    set last_number = last_number + 1, updated_at = now()
    where company_id = v_doc.company_id
      and doc_type = v_doc.doc_type
      and point_of_sale = v_doc.point_of_sale
    returning last_number into v_next;
  end if;

  update public.documents
  set status = p_target_status,
      document_number = coalesce(v_next, document_number),
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
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

  if p_target_status = 'ANULADO' then
    insert into public.document_events (document_id, event_type, payload, created_by)
    values (
      v_doc.id,
      'STATUS_CHANGED',
      jsonb_build_object(
        'from', v_doc.status,
        'to', p_target_status,
        'document_number', coalesce(v_updated.document_number, v_doc.document_number)
      ),
      v_actor
    );
  elsif v_doc.doc_type = 'PRESUPUESTO' and p_target_status in ('ENVIADO', 'APROBADO', 'RECHAZADO') then
    insert into public.document_events (document_id, event_type, payload, created_by)
    values (v_doc.id, 'STATUS_CHANGED', jsonb_build_object('to', p_target_status::text), v_actor);
  end if;

  return v_updated;
end;
$$;
