create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_now timestamptz := now();
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status <> 'BORRADOR' then
    raise exception 'Solo se pueden emitir remitos en borrador';
  end if;

  update public.documents
  set status = 'EMITIDO',
      issued_at = v_now,
      issue_date = v_now at time zone 'America/Argentina/Buenos_Aires'
  where id = p_document_id
  returning * into v_doc;

  return v_doc;
end;
$$;
