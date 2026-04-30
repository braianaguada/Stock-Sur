create or replace function public.transition_service_document_status(
  p_document_id uuid,
  p_target_status public.service_document_status
)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.service_documents%rowtype;
  v_updated public.service_documents%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para cambiar el estado de documentos de servicio';
  end if;

  select * into v_doc
  from public.service_documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento de servicio no encontrado';
  end if;

  if not (
    (p_target_status in ('SENT', 'APPROVED', 'REJECTED') and public.has_company_permission(v_actor, v_doc.company_id, 'documents.approve'))
    or (p_target_status = 'CANCELLED' and public.has_company_permission(v_actor, v_doc.company_id, 'documents.cancel'))
  ) then
    raise exception 'No tienes permisos para cambiar el estado';
  end if;

  if v_doc.status = p_target_status then
    return v_doc;
  end if;

  if v_doc.status = 'DRAFT' and p_target_status not in ('SENT', 'APPROVED', 'REJECTED', 'CANCELLED') then
    raise exception 'Transicion invalida';
  end if;

  if v_doc.status = 'SENT' and p_target_status not in ('APPROVED', 'REJECTED', 'CANCELLED') then
    raise exception 'Transicion invalida';
  end if;

  if v_doc.status = 'APPROVED' and p_target_status <> 'CANCELLED' then
    raise exception 'Un documento aprobado solo puede anularse';
  end if;

  if v_doc.status in ('REJECTED', 'CANCELLED') then
    raise exception 'El documento ya no admite cambios de estado';
  end if;

  update public.service_documents
  set status = p_target_status,
      updated_at = now()
  where id = v_doc.id
  returning * into v_updated;

  insert into public.service_document_events (
    document_id,
    event_type,
    payload,
    created_by
  ) values (
    v_updated.id,
    'STATUS_CHANGED',
    jsonb_build_object('from', v_doc.status, 'to', p_target_status),
    v_actor
  );

  return v_updated;
end;
$$;

grant execute on function public.transition_service_document_status(uuid, public.service_document_status) to authenticated;
