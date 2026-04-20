drop policy if exists "document_lines_insert_company_member" on public.document_lines;
drop policy if exists "document_lines_update_company_member" on public.document_lines;
drop policy if exists "document_lines_delete_company_member" on public.document_lines;

create policy "document_lines_insert_company_member"
on public.document_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "document_lines_update_company_member"
on public.document_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
)
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "document_lines_delete_company_member"
on public.document_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);
