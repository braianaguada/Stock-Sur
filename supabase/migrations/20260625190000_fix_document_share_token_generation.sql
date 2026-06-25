create or replace function public.create_document_share_link(
  p_document_id uuid,
  p_expires_at timestamptz default null
)
returns public.document_share_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_link public.document_share_links%rowtype;
begin
  if v_actor is null then raise exception 'Debes iniciar sesion para compartir documentos'; end if;

  select * into v_doc from public.documents where id = p_document_id;
  if not found or v_doc.doc_type::text not in ('PRESUPUESTO', 'REMITO') then
    raise exception 'Documento no encontrado o no compartible';
  end if;
  if not public.is_company_member(v_actor, v_doc.company_id)
     or not public.has_company_permission(v_actor, v_doc.company_id, 'documents.print') then
    raise exception 'No tienes permisos para compartir este documento';
  end if;

  select * into v_link
  from public.document_share_links
  where document_id = p_document_id and enabled
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;
  if found then return v_link; end if;

  insert into public.document_share_links(company_id, document_id, token, expires_at, created_by)
  values (
    v_doc.company_id,
    v_doc.id,
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    p_expires_at,
    v_actor
  )
  returning * into v_link;
  return v_link;
end;
$$;

grant execute on function public.create_document_share_link(uuid, timestamptz) to authenticated;
