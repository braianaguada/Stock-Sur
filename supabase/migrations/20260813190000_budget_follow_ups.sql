create table public.budget_follow_ups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH')),
  next_contact_on date null,
  last_contacted_at timestamptz null,
  contact_count integer not null default 0 check (contact_count >= 0),
  notes text null,
  created_by uuid not null default auth.uid() references auth.users(id),
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, document_id)
);

create index budget_follow_ups_company_next_contact_idx
  on public.budget_follow_ups (company_id, next_contact_on);

create or replace function public.validate_budget_follow_up()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_doc_type public.document_type;
begin
  if tg_op = 'UPDATE' then
    new.company_id := old.company_id;
    new.document_id := old.document_id;
    new.created_by := old.created_by;
  end if;

  select company_id, doc_type
    into v_company_id, v_doc_type
  from public.documents
  where id = new.document_id;

  if v_company_id is null or v_company_id <> new.company_id then
    raise exception 'El presupuesto no pertenece a la empresa indicada.';
  end if;
  if v_doc_type <> 'PRESUPUESTO' then
    raise exception 'El seguimiento solo puede asociarse a presupuestos.';
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger budget_follow_ups_validate
before insert or update on public.budget_follow_ups
for each row execute function public.validate_budget_follow_up();

alter table public.budget_follow_ups enable row level security;

create policy "budget_follow_ups_read_company_documents"
on public.budget_follow_ups for select to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "budget_follow_ups_insert_company_documents"
on public.budget_follow_ups for insert to authenticated
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "budget_follow_ups_update_company_documents"
on public.budget_follow_ups for update to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
  and updated_by = auth.uid()
);

comment on table public.budget_follow_ups is
  'Agenda comercial de presupuestos; no reemplaza ni modifica el estado operativo del documento.';
