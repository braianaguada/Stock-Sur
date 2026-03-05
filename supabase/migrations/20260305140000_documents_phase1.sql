do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_type' and n.nspname = 'public'
  ) then
    create type public.document_type as enum ('PRESUPUESTO', 'REMITO');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_status' and n.nspname = 'public'
  ) then
    create type public.document_status as enum ('DRAFT', 'ISSUED', 'CANCELLED');
  end if;
end
$$;

create table if not exists public.document_sequences (
  id uuid primary key default gen_random_uuid(),
  doc_type public.document_type not null,
  point_of_sale integer not null default 1,
  last_number integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (doc_type, point_of_sale)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  doc_type public.document_type not null,
  status public.document_status not null default 'DRAFT',
  point_of_sale integer not null default 1,
  document_number integer null,
  issue_date date not null default now()::date,
  customer_id uuid null references public.customers(id),
  customer_name text null,
  customer_tax_id text null,
  customer_tax_condition text null,
  price_list_id uuid null references public.price_lists(id),
  notes text null,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists documents_unique_number
  on public.documents(doc_type, point_of_sale, document_number)
  where document_number is not null;

create index if not exists documents_search_idx
  on public.documents(doc_type, status, issue_date desc, customer_name);

create table if not exists public.document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  line_order integer not null default 1,
  item_id uuid null references public.items(id),
  sku_snapshot text null,
  description text not null,
  unit text null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  discount_pct numeric(8,4) not null default 0,
  line_total numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_lines_doc_idx on public.document_lines(document_id, line_order);

create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  event_type text not null,
  payload jsonb null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists document_events_doc_idx on public.document_events(document_id, created_at desc);

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
      issue_date = coalesce(issue_date, now()::date),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (v_doc.id, 'ISSUED', jsonb_build_object('document_number', v_doc.document_number), auth.uid());

  return v_doc;
end;
$$;

alter table public.document_sequences enable row level security;
alter table public.documents enable row level security;
alter table public.document_lines enable row level security;
alter table public.document_events enable row level security;

drop policy if exists "document_sequences_read_authenticated" on public.document_sequences;
drop policy if exists "document_sequences_write_admin" on public.document_sequences;
create policy "document_sequences_read_authenticated" on public.document_sequences
for select to authenticated using (true);
create policy "document_sequences_write_admin" on public.document_sequences
for all to authenticated using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "documents_read_authenticated" on public.documents;
drop policy if exists "documents_insert_owner_or_admin" on public.documents;
drop policy if exists "documents_update_owner_or_admin" on public.documents;
drop policy if exists "documents_delete_owner_or_admin" on public.documents;
create policy "documents_read_authenticated" on public.documents for select to authenticated using (true);
create policy "documents_insert_owner_or_admin" on public.documents for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "documents_update_owner_or_admin" on public.documents for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "documents_delete_owner_or_admin" on public.documents for delete to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "document_lines_read_authenticated" on public.document_lines;
drop policy if exists "document_lines_insert_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_update_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_delete_owner_or_admin" on public.document_lines;
create policy "document_lines_read_authenticated" on public.document_lines for select to authenticated using (true);
create policy "document_lines_insert_owner_or_admin" on public.document_lines for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "document_lines_update_owner_or_admin" on public.document_lines for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "document_lines_delete_owner_or_admin" on public.document_lines for delete to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "document_events_read_authenticated" on public.document_events;
drop policy if exists "document_events_insert_owner_or_admin" on public.document_events;
create policy "document_events_read_authenticated" on public.document_events for select to authenticated using (true);
create policy "document_events_insert_owner_or_admin" on public.document_events for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
