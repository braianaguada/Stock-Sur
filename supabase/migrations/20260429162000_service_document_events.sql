create table if not exists public.service_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.service_documents(id) on delete cascade,
  event_type text not null,
  payload jsonb null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists service_document_events_doc_idx
  on public.service_document_events(document_id, created_at desc);

alter table public.service_document_events enable row level security;

drop policy if exists "service_document_events_read_company_member" on public.service_document_events;
drop policy if exists "service_document_events_insert_company_member" on public.service_document_events;

create policy "service_document_events_read_company_member"
on public.service_document_events
for select
to authenticated
using (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.view')
  )
);

create policy "service_document_events_insert_company_member"
on public.service_document_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and public.is_company_member(auth.uid(), d.company_id)
      and (
        public.has_company_permission(auth.uid(), d.company_id, 'documents.create')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.approve')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.cancel')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.print')
      )
  )
);
