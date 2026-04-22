create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_now timestamptz := now();
  v_is_eligible boolean := false;
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

  select exists (
    select 1
    from public.documents d
    join public.customers c on c.id = d.customer_id
    where d.id = v_doc.id
      and d.doc_type = 'REMITO'
      and d.status = 'EMITIDO'
      and d.customer_id is not null
      and c.is_occasional = false
  ) into v_is_eligible;

  if v_is_eligible then
    perform public.register_customer_account_debit_from_document(
      v_doc.company_id,
      v_doc.customer_id,
      v_doc.id,
      v_doc.total,
      null,
      null,
      jsonb_build_object('source', 'issue_document')
    );
  end if;

  return v_doc;
end;
$$;

revoke all on function public.issue_document(uuid) from public;
grant execute on function public.issue_document(uuid) to authenticated;
