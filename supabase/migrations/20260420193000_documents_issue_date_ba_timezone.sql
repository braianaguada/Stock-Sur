alter table public.documents
  alter column issue_date set default timezone('America/Argentina/Buenos_Aires', now())::date;

update public.documents
set issue_date = timezone('America/Argentina/Buenos_Aires', created_at)::date
where issue_date = created_at::date
  and issue_date <> timezone('America/Argentina/Buenos_Aires', created_at)::date;

create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_next integer;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status <> 'DRAFT' then
    raise exception 'Solo se pueden emitir borradores';
  end if;

  insert into public.document_sequences (doc_type, point_of_sale, last_number)
  values (v_doc.doc_type, v_doc.point_of_sale, 0)
  on conflict (doc_type, point_of_sale) do nothing;

  update public.document_sequences
  set last_number = last_number + 1, updated_at = now()
  where doc_type = v_doc.doc_type and point_of_sale = v_doc.point_of_sale
  returning last_number into v_next;

  update public.documents
  set status = 'ISSUED',
      document_number = v_next,
      issue_date = coalesce(issue_date, timezone('America/Argentina/Buenos_Aires', now())::date),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (v_doc.id, 'ISSUED', jsonb_build_object('document_number', v_doc.document_number), auth.uid());

  return v_doc;
end;
$$;
