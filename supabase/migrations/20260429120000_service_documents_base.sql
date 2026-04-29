do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'service_document_type' and n.nspname = 'public'
  ) then
    create type public.service_document_type as enum ('QUOTE');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'service_document_status' and n.nspname = 'public'
  ) then
    create type public.service_document_status as enum ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CANCELLED');
  end if;
end
$$;

create table if not exists public.service_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  type public.service_document_type not null default 'QUOTE',
  status public.service_document_status not null default 'DRAFT',
  number integer not null,
  reference text null,
  issue_date date not null default current_date,
  valid_until date null,
  delivery_time text null,
  payment_terms text null,
  delivery_location text null,
  intro_text text null,
  closing_text text null,
  subtotal numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  currency text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint service_documents_total_non_negative check (subtotal >= 0 and total >= 0),
  constraint service_documents_number_positive check (number > 0)
);

create table if not exists public.service_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.service_documents(id) on delete cascade,
  description text not null,
  quantity numeric(14,3) null,
  unit text null,
  unit_price numeric(14,2) null,
  line_total numeric(14,2) not null default 0,
  sort_order integer not null default 1,
  constraint service_document_lines_sort_positive check (sort_order > 0)
);

create unique index if not exists service_documents_company_type_number_key
  on public.service_documents(company_id, type, number);

create index if not exists service_documents_company_lookup_idx
  on public.service_documents(company_id, created_at desc, status, issue_date desc);

create index if not exists service_document_lines_document_idx
  on public.service_document_lines(document_id, sort_order);

create or replace function public.set_next_service_document_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.number is null then
    select coalesce(max(number), 0) + 1
    into new.number
    from public.service_documents
    where company_id = new.company_id
      and type = new.type;
  end if;

  return new;
end;
$$;

drop trigger if exists set_service_document_number on public.service_documents;
create trigger set_service_document_number
before insert on public.service_documents
for each row execute function public.set_next_service_document_number();

drop trigger if exists update_service_documents_updated_at on public.service_documents;
create trigger update_service_documents_updated_at
before update on public.service_documents
for each row execute function public.update_updated_at_column();

alter table public.service_documents enable row level security;
alter table public.service_document_lines enable row level security;

drop policy if exists "service_documents_read_company_member" on public.service_documents;
drop policy if exists "service_documents_insert_company_member" on public.service_documents;
drop policy if exists "service_documents_update_company_member" on public.service_documents;
drop policy if exists "service_document_lines_read_company_member" on public.service_document_lines;
drop policy if exists "service_document_lines_insert_company_member" on public.service_document_lines;
drop policy if exists "service_document_lines_update_company_member" on public.service_document_lines;
drop policy if exists "service_document_lines_delete_company_member" on public.service_document_lines;

create policy "service_documents_read_company_member"
on public.service_documents
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "service_documents_insert_company_member"
on public.service_documents
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'documents.create')
  and created_by = auth.uid()
);

create policy "service_documents_update_company_member"
on public.service_documents
for update
to authenticated
using (
  status = 'DRAFT'
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
)
with check (
  status = 'DRAFT'
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
);

create policy "service_document_lines_read_company_member"
on public.service_document_lines
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

create policy "service_document_lines_insert_company_member"
on public.service_document_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "service_document_lines_update_company_member"
on public.service_document_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
)
with check (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "service_document_lines_delete_company_member"
on public.service_document_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.service_documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);
