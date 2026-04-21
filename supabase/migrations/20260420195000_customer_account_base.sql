do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'customer_account_entry_type' and n.nspname = 'public'
  ) then
    create type public.customer_account_entry_type as enum ('DEBIT', 'CREDIT');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'customer_account_origin_type' and n.nspname = 'public'
  ) then
    create type public.customer_account_origin_type as enum ('DOCUMENT', 'CASH_SALE', 'MANUAL');
  end if;
end
$$;

create table if not exists public.customer_account_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  entry_type public.customer_account_entry_type not null,
  origin_type public.customer_account_origin_type not null,
  origin_id uuid not null,
  document_id uuid null references public.documents(id) on delete set null,
  cash_sale_id uuid null references public.cash_sales(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'ARS',
  business_date date not null default now()::date,
  description text not null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint customer_account_entries_amount_positive_check check (amount > 0),
  constraint customer_account_entries_origin_link_check check (
    (origin_type = 'DOCUMENT' and document_id is not null and cash_sale_id is null)
    or (origin_type = 'CASH_SALE' and cash_sale_id is not null and document_id is null)
    or (origin_type = 'MANUAL' and document_id is null and cash_sale_id is null)
  )
);

create index if not exists customer_account_entries_company_customer_idx
  on public.customer_account_entries(company_id, customer_id, business_date desc, created_at desc);

create index if not exists customer_account_entries_document_idx
  on public.customer_account_entries(document_id)
  where document_id is not null;

create index if not exists customer_account_entries_cash_sale_idx
  on public.customer_account_entries(cash_sale_id)
  where cash_sale_id is not null;

create unique index if not exists customer_account_entries_origin_unique_idx
  on public.customer_account_entries(company_id, origin_type, origin_id, entry_type);

alter table public.customer_account_entries enable row level security;

drop policy if exists "customer_account_entries_read_company_member" on public.customer_account_entries;
drop policy if exists "customer_account_entries_insert_owner_or_admin" on public.customer_account_entries;
create policy "customer_account_entries_read_company_member"
on public.customer_account_entries
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);
create policy "customer_account_entries_insert_owner_or_admin"
on public.customer_account_entries
for insert
to authenticated
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

create or replace view public.customer_account_balances as
select
  e.company_id,
  e.customer_id,
  coalesce(sum(case when e.entry_type = 'DEBIT' then e.amount else -e.amount end), 0)::numeric(14,2) as balance,
  count(*)::bigint as movements_count,
  max(e.created_at) as last_movement_at
from public.customer_account_entries e
group by e.company_id, e.customer_id;

create or replace function public.customer_account_summary(
  p_company_id uuid,
  p_customer_id uuid
)
returns table (
  company_id uuid,
  customer_id uuid,
  balance numeric(14,2),
  movements_count bigint,
  last_movement_at timestamptz,
  last_entry_type public.customer_account_entry_type,
  last_amount numeric(14,2),
  last_origin_type public.customer_account_origin_type,
  last_origin_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    e.company_id,
    e.customer_id,
    coalesce(sum(case when e.entry_type = 'DEBIT' then e.amount else -e.amount end), 0)::numeric(14,2) as balance,
    count(*)::bigint as movements_count,
    max(e.created_at) as last_movement_at,
    (array_agg(e.entry_type order by e.created_at desc, e.created_at desc, e.id desc))[1] as last_entry_type,
    (array_agg(e.amount order by e.created_at desc, e.id desc))[1] as last_amount,
    (array_agg(e.origin_type order by e.created_at desc, e.id desc))[1] as last_origin_type,
    (array_agg(e.origin_id order by e.created_at desc, e.id desc))[1] as last_origin_id
  from public.customer_account_entries e
  where e.company_id = p_company_id
    and e.customer_id = p_customer_id
  group by e.company_id, e.customer_id;
$$;

create or replace function public.record_customer_account_entry(
  p_company_id uuid,
  p_customer_id uuid,
  p_entry_type public.customer_account_entry_type,
  p_origin_type public.customer_account_origin_type,
  p_origin_id uuid,
  p_amount numeric(14,2),
  p_description text,
  p_business_date date default now()::date,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_document_id uuid default null,
  p_cash_sale_id uuid default null
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_existing public.customer_account_entries%rowtype;
  v_entry public.customer_account_entries%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar movimientos de cuenta corriente';
  end if;

  if not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No perteneces a la empresa del movimiento';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and company_id = p_company_id
  for share;

  if not found then
    raise exception 'Cliente no encontrado en la empresa indicada';
  end if;

  if v_customer.is_occasional then
    raise exception 'El cliente ocasional no puede generar cuenta corriente';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'El importe debe ser mayor a cero';
  end if;

  if p_origin_type = 'DOCUMENT' and p_document_id is null then
    raise exception 'El movimiento desde documento requiere document_id';
  end if;

  if p_origin_type = 'CASH_SALE' and p_cash_sale_id is null then
    raise exception 'El movimiento desde caja requiere cash_sale_id';
  end if;

  if p_origin_type = 'MANUAL' and (p_document_id is not null or p_cash_sale_id is not null) then
    raise exception 'El movimiento manual no puede referenciar otros orígenes';
  end if;

  if exists (
    select 1
    from public.customer_account_entries e
    where e.company_id = p_company_id
      and e.origin_type = p_origin_type
      and e.origin_id = p_origin_id
      and e.entry_type = p_entry_type
  ) then
    raise exception 'Ya existe un movimiento de cuenta corriente para ese origen';
  end if;

  if p_document_id is not null then
    perform 1
    from public.documents d
    where d.id = p_document_id
      and d.company_id = p_company_id
      and (d.customer_id is null or d.customer_id = p_customer_id);
    if not found then
      raise exception 'El documento no pertenece a la empresa o no coincide con el cliente';
    end if;
  end if;

  if p_cash_sale_id is not null then
    perform 1
    from public.cash_sales cs
    where cs.id = p_cash_sale_id
      and cs.company_id = p_company_id
      and (cs.customer_id is null or cs.customer_id = p_customer_id);
    if not found then
      raise exception 'La venta no pertenece a la empresa o no coincide con el cliente';
    end if;
  end if;

  insert into public.customer_account_entries (
    company_id, customer_id, entry_type, origin_type, origin_id,
    document_id, cash_sale_id, amount, business_date, description,
    notes, metadata, created_by
  )
  values (
    p_company_id, p_customer_id, p_entry_type, p_origin_type, p_origin_id,
    p_document_id, p_cash_sale_id, p_amount, p_business_date, p_description,
    p_notes, coalesce(p_metadata, '{}'::jsonb), v_actor
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

create or replace function public.register_customer_account_debit_from_document(
  p_company_id uuid,
  p_customer_id uuid,
  p_document_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.customer_id is null then
    raise exception 'La cuenta corriente requiere un cliente identificado';
  end if;

  if v_doc.customer_id <> p_customer_id then
    raise exception 'El cliente del documento no coincide';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se contemplan remitos en esta etapa';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'DEBIT',
    'DOCUMENT',
    p_document_id,
    coalesce(p_amount, v_doc.total),
    coalesce(p_description, format('Debito por %s', v_doc.doc_type::text)),
    v_doc.issue_date,
    p_notes,
    p_metadata,
    p_document_id,
    null
  );
end;
$$;

create or replace function public.register_customer_account_credit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.register_customer_account_debit_from_cash_sale(
    p_company_id,
    p_customer_id,
    p_cash_sale_id,
    p_amount,
    p_description,
    p_notes,
    p_metadata
  );
end;
$$;

create or replace function public.register_customer_account_debit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.cash_sales%rowtype;
begin
  select * into v_sale
  from public.cash_sales
  where id = p_cash_sale_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.customer_id is null then
    raise exception 'La venta a cuenta corriente requiere cliente identificado';
  end if;

  if v_sale.customer_id <> p_customer_id then
    raise exception 'El cliente de la venta no coincide';
  end if;

  if v_sale.payment_method <> 'CUENTA_CORRIENTE' then
    raise exception 'Solo se puede registrar deuda desde una venta a cuenta corriente';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'DEBIT',
    'CASH_SALE',
    p_cash_sale_id,
    coalesce(p_amount, v_sale.amount_total),
    coalesce(p_description, 'Venta fiada por caja'),
    v_sale.business_date,
    p_notes,
    p_metadata,
    null,
    p_cash_sale_id
  );
end;
$$;

create or replace function public.validate_cash_sale_account_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  if new.payment_method <> 'CUENTA_CORRIENTE' then
    return new;
  end if;

  if new.customer_id is null then
    raise exception 'La cuenta corriente requiere cliente identificado';
  end if;

  select *
  into v_customer
  from public.customers
  where id = new.customer_id
    and company_id = new.company_id;

  if not found then
    raise exception 'El cliente de la venta no pertenece a la empresa';
  end if;

  if v_customer.is_occasional then
    raise exception 'El cliente ocasional no puede usarse en cuenta corriente';
  end if;

  if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
    new.customer_name_snapshot := v_customer.name;
  end if;

  return new;
end;
$$;

create or replace function public.customer_account_eligible_document(
  p_document_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    join public.customers c on c.id = d.customer_id
    where d.id = p_document_id
      and d.doc_type = 'REMITO'
      and d.status = 'EMITIDO'
      and d.customer_id is not null
      and c.is_occasional = false
  );
$$;

drop trigger if exists trg_cash_sales_validate_account_customer on public.cash_sales;
create trigger trg_cash_sales_validate_account_customer
before insert or update on public.cash_sales
for each row execute function public.validate_cash_sale_account_customer();

alter table public.cash_sales
  drop constraint if exists cash_sales_customer_required_for_account_check;

alter table public.cash_sales
  add constraint cash_sales_customer_required_for_account_check check (
    payment_method <> 'CUENTA_CORRIENTE' or customer_id is not null
  );
