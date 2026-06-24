do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'settlement_status' and n.nspname = 'public'
  ) then
    create type public.settlement_status as enum ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED');
  end if;
end
$$;

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  settlement_number integer null,
  settlement_date date not null default current_date,
  period_from date null,
  period_to date null,
  status public.settlement_status not null default 'DRAFT',
  prepared_by_name text null,
  received_by_name text null,
  received_at timestamptz null,
  submitted_by uuid null references auth.users(id) on delete set null,
  submitted_at timestamptz null,
  cancelled_by uuid null references auth.users(id) on delete set null,
  cancelled_at timestamptz null,
  notes text null,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_number_positive_check check (settlement_number is null or settlement_number > 0),
  constraint settlements_draft_without_number_check check (status <> 'DRAFT' or settlement_number is null),
  constraint settlements_submitted_number_check check (status in ('DRAFT', 'CANCELLED') or settlement_number is not null),
  constraint settlements_received_fields_check check (
    status <> 'RECEIVED'
    or (received_by_name is not null and length(trim(received_by_name)) > 0 and received_at is not null)
  ),
  constraint settlements_period_order_check check (
    period_from is null or period_to is null or period_from <= period_to
  )
);

create table if not exists public.settlement_income_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  line_date date not null,
  work_order text null,
  receipt text null,
  quote text null,
  customer_name text null,
  concept text not null,
  cash_amount numeric(14,2) not null default 0,
  other_amount numeric(14,2) not null default 0,
  income_type text null,
  display_order integer not null default 1,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_income_lines_concept_not_blank check (length(trim(concept)) > 0),
  constraint settlement_income_lines_cash_non_negative check (cash_amount >= 0),
  constraint settlement_income_lines_other_non_negative check (other_amount >= 0),
  constraint settlement_income_lines_display_order_positive check (display_order > 0)
);

create table if not exists public.settlement_expense_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete cascade,
  line_date date not null,
  receipt text null,
  supplier_name text null,
  detail text not null,
  purchase_order text null,
  cash_amount numeric(14,2) not null default 0,
  other_amount numeric(14,2) not null default 0,
  display_order integer not null default 1,
  created_by uuid null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_expense_lines_detail_not_blank check (length(trim(detail)) > 0),
  constraint settlement_expense_lines_cash_non_negative check (cash_amount >= 0),
  constraint settlement_expense_lines_other_non_negative check (other_amount >= 0),
  constraint settlement_expense_lines_display_order_positive check (display_order > 0)
);

create unique index if not exists settlements_company_number_unique_idx
  on public.settlements(company_id, settlement_number)
  where settlement_number is not null;

create index if not exists settlements_company_status_date_idx
  on public.settlements(company_id, status, settlement_date desc, created_at desc);

create index if not exists settlement_income_lines_settlement_order_idx
  on public.settlement_income_lines(settlement_id, display_order, created_at);

create index if not exists settlement_expense_lines_settlement_order_idx
  on public.settlement_expense_lines(settlement_id, display_order, created_at);

create or replace function public.can_operate_settlement_company(
  _user_id uuid,
  _company_id uuid,
  _permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = _company_id
      and c.status = 'ACTIVE'
  )
  and public.is_company_member(_user_id, _company_id)
  and public.has_company_permission(_user_id, _company_id, _permission_code);
$$;

create or replace function public.validate_settlement_header()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.prepared_by_name is not null then
    new.prepared_by_name := nullif(trim(new.prepared_by_name), '');
  end if;

  if new.received_by_name is not null then
    new.received_by_name := nullif(trim(new.received_by_name), '');
  end if;

  if new.notes is not null then
    new.notes := nullif(trim(new.notes), '');
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'DRAFT' then
      raise exception 'Las rendiciones se crean como borrador';
    end if;

    if new.settlement_number is not null then
      raise exception 'El numero se asigna al presentar la rendicion';
    end if;

    if new.received_at is not null or new.received_by_name is not null then
      raise exception 'Una rendicion borrador no puede tener recepcion';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'No se puede cambiar la empresa de una rendicion';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el creador de una rendicion';
    end if;

    if old.status <> 'DRAFT' and new.status = old.status then
      raise exception 'Solo las rendiciones en borrador son editables';
    end if;

    if old.status = 'DRAFT'
       and new.status = 'DRAFT'
       and (
         new.settlement_number is distinct from old.settlement_number
         or new.received_at is distinct from old.received_at
         or new.received_by_name is distinct from old.received_by_name
         or new.submitted_at is distinct from old.submitted_at
         or new.submitted_by is distinct from old.submitted_by
         or new.cancelled_at is distinct from old.cancelled_at
         or new.cancelled_by is distinct from old.cancelled_by
       ) then
      raise exception 'Los campos de workflow se actualizan mediante RPC';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_settlement_income_line()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_settlement record;
  v_settlement_id uuid;
begin
  v_settlement_id := case when tg_op = 'DELETE' then old.settlement_id else new.settlement_id end;

  select company_id, status
  into v_settlement
  from public.settlements
  where id = v_settlement_id;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if v_settlement.status <> 'DRAFT' then
    raise exception 'No se pueden modificar detalles de una rendicion fuera de borrador';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  new.company_id := v_settlement.company_id;
  new.concept := trim(new.concept);
  new.work_order := nullif(trim(coalesce(new.work_order, '')), '');
  new.receipt := nullif(trim(coalesce(new.receipt, '')), '');
  new.quote := nullif(trim(coalesce(new.quote, '')), '');
  new.customer_name := nullif(trim(coalesce(new.customer_name, '')), '');
  new.income_type := nullif(trim(coalesce(new.income_type, '')), '');

  return new;
end;
$$;

create or replace function public.validate_settlement_expense_line()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_settlement record;
  v_settlement_id uuid;
begin
  v_settlement_id := case when tg_op = 'DELETE' then old.settlement_id else new.settlement_id end;

  select company_id, status
  into v_settlement
  from public.settlements
  where id = v_settlement_id;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if v_settlement.status <> 'DRAFT' then
    raise exception 'No se pueden modificar detalles de una rendicion fuera de borrador';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  new.company_id := v_settlement.company_id;
  new.detail := trim(new.detail);
  new.receipt := nullif(trim(coalesce(new.receipt, '')), '');
  new.supplier_name := nullif(trim(coalesce(new.supplier_name, '')), '');
  new.purchase_order := nullif(trim(coalesce(new.purchase_order, '')), '');

  return new;
end;
$$;

drop trigger if exists validate_settlement_header on public.settlements;
create trigger validate_settlement_header
before insert or update on public.settlements
for each row execute function public.validate_settlement_header();

drop trigger if exists update_settlements_updated_at on public.settlements;
create trigger update_settlements_updated_at
before update on public.settlements
for each row execute function public.update_updated_at_column();

drop trigger if exists validate_settlement_income_line on public.settlement_income_lines;
create trigger validate_settlement_income_line
before insert or update or delete on public.settlement_income_lines
for each row execute function public.validate_settlement_income_line();

drop trigger if exists update_settlement_income_lines_updated_at on public.settlement_income_lines;
create trigger update_settlement_income_lines_updated_at
before update on public.settlement_income_lines
for each row execute function public.update_updated_at_column();

drop trigger if exists validate_settlement_expense_line on public.settlement_expense_lines;
create trigger validate_settlement_expense_line
before insert or update or delete on public.settlement_expense_lines
for each row execute function public.validate_settlement_expense_line();

drop trigger if exists update_settlement_expense_lines_updated_at on public.settlement_expense_lines;
create trigger update_settlement_expense_lines_updated_at
before update on public.settlement_expense_lines
for each row execute function public.update_updated_at_column();

insert into public.permissions (code, module, action, description)
values
  ('settlements.view', 'settlements', 'view', 'Ver rendiciones'),
  ('settlements.create', 'settlements', 'create', 'Crear borradores de rendiciones'),
  ('settlements.edit', 'settlements', 'edit', 'Editar borradores de rendiciones'),
  ('settlements.submit', 'settlements', 'submit', 'Presentar rendiciones'),
  ('settlements.receive', 'settlements', 'receive', 'Recibir rendiciones'),
  ('settlements.cancel', 'settlements', 'cancel', 'Anular rendiciones')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code like 'settlements.%'
where r.code = 'admin' and r.scope = 'COMPANY'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'settlements.view',
  'settlements.create',
  'settlements.edit',
  'settlements.submit'
)
where r.code = 'operador' and r.scope = 'COMPANY'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'settlements.view'
where r.code = 'consulta' and r.scope = 'COMPANY'
on conflict do nothing;

alter table public.settlements enable row level security;
alter table public.settlement_income_lines enable row level security;
alter table public.settlement_expense_lines enable row level security;

create policy "settlements_read_company_member"
on public.settlements
for select
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.view')
);

create policy "settlements_insert_company_member"
on public.settlements
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.create')
  and created_by = auth.uid()
  and status = 'DRAFT'
  and settlement_number is null
  and received_at is null
  and received_by_name is null
);

create policy "settlements_update_draft_company_member"
on public.settlements
for update
to authenticated
using (
  status = 'DRAFT'
  and public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
)
with check (
  status = 'DRAFT'
  and public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and settlement_number is null
  and received_at is null
  and received_by_name is null
);

create policy "settlements_delete_draft_company_member"
on public.settlements
for delete
to authenticated
using (
  status = 'DRAFT'
  and public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
);

create policy "settlement_income_lines_read_company_member"
on public.settlement_income_lines
for select
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.view')
);

create policy "settlement_income_lines_insert_company_member"
on public.settlement_income_lines
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create policy "settlement_income_lines_update_company_member"
on public.settlement_income_lines
for update
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
)
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create policy "settlement_income_lines_delete_company_member"
on public.settlement_income_lines
for delete
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create policy "settlement_expense_lines_read_company_member"
on public.settlement_expense_lines
for select
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.view')
);

create policy "settlement_expense_lines_insert_company_member"
on public.settlement_expense_lines
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create policy "settlement_expense_lines_update_company_member"
on public.settlement_expense_lines
for update
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
)
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create policy "settlement_expense_lines_delete_company_member"
on public.settlement_expense_lines
for delete
to authenticated
using (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

create or replace function public.get_settlement_totals(p_settlement_id uuid)
returns table (
  income_cash_total numeric,
  income_other_total numeric,
  income_total numeric,
  expense_cash_total numeric,
  expense_other_total numeric,
  expense_total numeric,
  settlement_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with income_totals as (
    select
      coalesce(sum(cash_amount), 0)::numeric(14,2) as cash_total,
      coalesce(sum(other_amount), 0)::numeric(14,2) as other_total
    from public.settlement_income_lines
    where settlement_id = p_settlement_id
  ),
  expense_totals as (
    select
      coalesce(sum(cash_amount), 0)::numeric(14,2) as cash_total,
      coalesce(sum(other_amount), 0)::numeric(14,2) as other_total
    from public.settlement_expense_lines
    where settlement_id = p_settlement_id
  )
  select
    i.cash_total,
    i.other_total,
    (i.cash_total + i.other_total)::numeric(14,2),
    e.cash_total,
    e.other_total,
    (e.cash_total + e.other_total)::numeric(14,2),
    ((i.cash_total + i.other_total) - (e.cash_total + e.other_total))::numeric(14,2)
  from income_totals i
  cross join expense_totals e
  where exists (
    select 1
    from public.settlements s
    where s.id = p_settlement_id
      and public.can_operate_settlement_company(auth.uid(), s.company_id, 'settlements.view')
  );
$$;

create or replace function public.submit_settlement(p_settlement_id uuid)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_settlement public.settlements%rowtype;
  v_next_number integer;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para presentar una rendicion';
  end if;

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if not public.can_operate_settlement_company(v_actor, v_settlement.company_id, 'settlements.submit') then
    raise exception 'No tienes permisos para presentar rendiciones';
  end if;

  if v_settlement.status <> 'DRAFT' then
    raise exception 'Solo se pueden presentar rendiciones en borrador';
  end if;

  perform pg_advisory_xact_lock(777001, hashtext(v_settlement.company_id::text));

  select coalesce(max(settlement_number), 0) + 1
  into v_next_number
  from public.settlements
  where company_id = v_settlement.company_id
    and settlement_number is not null;

  update public.settlements
  set status = 'SUBMITTED',
      settlement_number = v_next_number,
      submitted_by = v_actor,
      submitted_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

create or replace function public.receive_settlement(
  p_settlement_id uuid,
  p_received_by_name text
)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_settlement public.settlements%rowtype;
  v_received_by_name text := nullif(trim(coalesce(p_received_by_name, '')), '');
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para recibir una rendicion';
  end if;

  if v_received_by_name is null then
    raise exception 'Debes indicar quien recibio la rendicion';
  end if;

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if not public.can_operate_settlement_company(v_actor, v_settlement.company_id, 'settlements.receive') then
    raise exception 'No tienes permisos para recibir rendiciones';
  end if;

  if v_settlement.status <> 'SUBMITTED' then
    raise exception 'Solo se pueden recibir rendiciones presentadas';
  end if;

  update public.settlements
  set status = 'RECEIVED',
      received_by_name = v_received_by_name,
      received_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

create or replace function public.cancel_settlement(p_settlement_id uuid)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_settlement public.settlements%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para anular una rendicion';
  end if;

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if not public.can_operate_settlement_company(v_actor, v_settlement.company_id, 'settlements.cancel') then
    raise exception 'No tienes permisos para anular rendiciones';
  end if;

  if v_settlement.status = 'CANCELLED' then
    return v_settlement;
  end if;

  update public.settlements
  set status = 'CANCELLED',
      cancelled_by = v_actor,
      cancelled_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  return v_settlement;
end;
$$;

revoke all on function public.can_operate_settlement_company(uuid, uuid, text) from public;
grant execute on function public.can_operate_settlement_company(uuid, uuid, text) to authenticated;

revoke all on function public.get_settlement_totals(uuid) from public;
grant execute on function public.get_settlement_totals(uuid) to authenticated;

revoke all on function public.submit_settlement(uuid) from public;
grant execute on function public.submit_settlement(uuid) to authenticated;

revoke all on function public.receive_settlement(uuid, text) from public;
grant execute on function public.receive_settlement(uuid, text) to authenticated;

revoke all on function public.cancel_settlement(uuid) from public;
grant execute on function public.cancel_settlement(uuid) to authenticated;

notify pgrst, 'reload schema';
