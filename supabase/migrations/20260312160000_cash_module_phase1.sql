do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_payment_method' and n.nspname = 'public'
  ) then
    create type public.cash_payment_method as enum (
      'EFECTIVO',
      'POINT',
      'TRANSFERENCIA',
      'CUENTA_CORRIENTE'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_receipt_kind' and n.nspname = 'public'
  ) then
    create type public.cash_receipt_kind as enum (
      'PENDIENTE',
      'REMITO',
      'FACTURA'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_sale_status' and n.nspname = 'public'
  ) then
    create type public.cash_sale_status as enum (
      'REGISTRADA',
      'PENDIENTE_COMPROBANTE',
      'COMPROBANTADA',
      'ANULADA'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_expense_kind' and n.nspname = 'public'
  ) then
    create type public.cash_expense_kind as enum (
      'CAJA',
      'CUENTA_CORRIENTE'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_closure_status' and n.nspname = 'public'
  ) then
    create type public.cash_closure_status as enum (
      'ABIERTO',
      'CERRADO'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'cash_event_entity_type' and n.nspname = 'public'
  ) then
    create type public.cash_event_entity_type as enum (
      'VENTA',
      'GASTO',
      'CIERRE'
    );
  end if;
end
$$;

create table if not exists public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  status public.cash_closure_status not null default 'ABIERTO',
  responsible_id uuid not null default auth.uid() references auth.users(id),
  expected_cash_sales_total numeric(14,2) not null default 0,
  expected_point_sales_total numeric(14,2) not null default 0,
  expected_transfer_sales_total numeric(14,2) not null default 0,
  expected_account_sales_total numeric(14,2) not null default 0,
  expected_cash_expenses_total numeric(14,2) not null default 0,
  expected_account_expenses_total numeric(14,2) not null default 0,
  expected_sales_total numeric(14,2) not null default 0,
  expected_cash_to_render numeric(14,2) not null default 0,
  expected_non_cash_total numeric(14,2) not null default 0,
  counted_cash_total numeric(14,2) null,
  counted_point_total numeric(14,2) null,
  counted_transfer_total numeric(14,2) null,
  cash_difference numeric(14,2) null,
  point_difference numeric(14,2) null,
  transfer_difference numeric(14,2) null,
  notes text null,
  closed_at timestamptz null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_date)
);

create index if not exists cash_closures_status_idx
  on public.cash_closures(status, business_date desc);

create table if not exists public.cash_sales (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default now()::date,
  sold_at timestamptz not null default now(),
  customer_id uuid null references public.customers(id),
  customer_name_snapshot text null,
  payment_method public.cash_payment_method not null,
  receipt_kind public.cash_receipt_kind not null default 'PENDIENTE',
  status public.cash_sale_status not null default 'PENDIENTE_COMPROBANTE',
  document_id uuid null references public.documents(id),
  receipt_reference text null,
  amount_total numeric(14,2) not null,
  notes text null,
  closure_id uuid null references public.cash_closures(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancelled_by uuid null references auth.users(id),
  constraint cash_sales_amount_positive_check check (amount_total > 0),
  constraint cash_sales_customer_required_for_account_check check (
    payment_method <> 'CUENTA_CORRIENTE'
    or customer_id is not null
    or nullif(btrim(coalesce(customer_name_snapshot, '')), '') is not null
  ),
  constraint cash_sales_receipt_kind_consistency_check check (
    (receipt_kind = 'PENDIENTE' and document_id is null and nullif(btrim(coalesce(receipt_reference, '')), '') is null)
    or (
      receipt_kind = 'REMITO'
      and (
        document_id is not null
        or nullif(btrim(coalesce(receipt_reference, '')), '') is not null
      )
    )
    or (
      receipt_kind = 'FACTURA'
      and document_id is null
      and nullif(btrim(coalesce(receipt_reference, '')), '') is not null
    )
  ),
  constraint cash_sales_document_only_for_remito_check check (
    document_id is null or receipt_kind = 'REMITO'
  ),
  constraint cash_sales_pending_kind_consistency_check check (
    (receipt_kind = 'PENDIENTE' and status in ('REGISTRADA', 'PENDIENTE_COMPROBANTE'))
    or (receipt_kind <> 'PENDIENTE')
  ),
  constraint cash_sales_status_cancelled_metadata_check check (
    (status <> 'ANULADA' and cancelled_at is null and cancelled_by is null)
    or (status = 'ANULADA' and cancelled_at is not null and cancelled_by is not null)
  )
);

create index if not exists cash_sales_business_date_idx
  on public.cash_sales(business_date desc, sold_at desc);

create index if not exists cash_sales_status_idx
  on public.cash_sales(status, receipt_kind, payment_method);

create index if not exists cash_sales_document_idx
  on public.cash_sales(document_id)
  where document_id is not null;

create index if not exists cash_sales_closure_idx
  on public.cash_sales(closure_id)
  where closure_id is not null;

create table if not exists public.cash_expenses (
  id uuid primary key default gen_random_uuid(),
  business_date date not null default now()::date,
  spent_at timestamptz not null default now(),
  expense_kind public.cash_expense_kind not null default 'CAJA',
  amount_total numeric(14,2) not null,
  description text not null,
  receipt_reference text null,
  notes text null,
  closure_id uuid null references public.cash_closures(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  cancelled_by uuid null references auth.users(id),
  constraint cash_expenses_amount_positive_check check (amount_total > 0),
  constraint cash_expenses_cancelled_metadata_check check (
    (cancelled_at is null and cancelled_by is null)
    or (cancelled_at is not null and cancelled_by is not null)
  )
);

create index if not exists cash_expenses_business_date_idx
  on public.cash_expenses(business_date desc, spent_at desc);

create index if not exists cash_expenses_closure_idx
  on public.cash_expenses(closure_id)
  where closure_id is not null;

create table if not exists public.cash_events (
  id uuid primary key default gen_random_uuid(),
  entity_type public.cash_event_entity_type not null,
  entity_id uuid not null,
  event_type text not null,
  payload jsonb null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists cash_events_entity_idx
  on public.cash_events(entity_type, entity_id, created_at desc);

alter table public.cash_closures enable row level security;
alter table public.cash_sales enable row level security;
alter table public.cash_expenses enable row level security;
alter table public.cash_events enable row level security;

drop policy if exists "cash_closures_read_authenticated" on public.cash_closures;
drop policy if exists "cash_closures_insert_owner_or_admin" on public.cash_closures;
drop policy if exists "cash_closures_update_owner_or_admin" on public.cash_closures;
drop policy if exists "cash_closures_delete_owner_or_admin" on public.cash_closures;
create policy "cash_closures_read_authenticated" on public.cash_closures
for select to authenticated using (true);
create policy "cash_closures_insert_owner_or_admin" on public.cash_closures
for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_closures_update_owner_or_admin" on public.cash_closures
for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_closures_delete_owner_or_admin" on public.cash_closures
for delete to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "cash_sales_read_authenticated" on public.cash_sales;
drop policy if exists "cash_sales_insert_owner_or_admin" on public.cash_sales;
drop policy if exists "cash_sales_update_owner_or_admin" on public.cash_sales;
drop policy if exists "cash_sales_delete_owner_or_admin" on public.cash_sales;
create policy "cash_sales_read_authenticated" on public.cash_sales
for select to authenticated using (true);
create policy "cash_sales_insert_owner_or_admin" on public.cash_sales
for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_sales_update_owner_or_admin" on public.cash_sales
for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_sales_delete_owner_or_admin" on public.cash_sales
for delete to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "cash_expenses_read_authenticated" on public.cash_expenses;
drop policy if exists "cash_expenses_insert_owner_or_admin" on public.cash_expenses;
drop policy if exists "cash_expenses_update_owner_or_admin" on public.cash_expenses;
drop policy if exists "cash_expenses_delete_owner_or_admin" on public.cash_expenses;
create policy "cash_expenses_read_authenticated" on public.cash_expenses
for select to authenticated using (true);
create policy "cash_expenses_insert_owner_or_admin" on public.cash_expenses
for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_expenses_update_owner_or_admin" on public.cash_expenses
for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "cash_expenses_delete_owner_or_admin" on public.cash_expenses
for delete to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "cash_events_read_authenticated" on public.cash_events;
drop policy if exists "cash_events_insert_owner_or_admin" on public.cash_events;
create policy "cash_events_read_authenticated" on public.cash_events
for select to authenticated using (true);
create policy "cash_events_insert_owner_or_admin" on public.cash_events
for insert to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
