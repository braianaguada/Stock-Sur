alter table public.settlement_income_lines
  alter column created_by set not null;

alter table public.settlement_expense_lines
  alter column created_by set not null;

create or replace function public.validate_settlement_header()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_workflow_action text := nullif(current_setting('app.settlement_workflow_action', true), '');
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

    if new.settlement_number is not null
       or new.submitted_at is not null
       or new.submitted_by is not null
       or new.received_at is not null
       or new.received_by_name is not null
       or new.cancelled_at is not null
       or new.cancelled_by is not null then
      raise exception 'Los campos de workflow se actualizan mediante RPC';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'No se puede cambiar la empresa de una rendicion';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el creador de una rendicion';
    end if;

    if v_workflow_action is null then
      if new.status is distinct from old.status
         or new.settlement_number is distinct from old.settlement_number
         or new.received_at is distinct from old.received_at
         or new.received_by_name is distinct from old.received_by_name
         or new.submitted_at is distinct from old.submitted_at
         or new.submitted_by is distinct from old.submitted_by
         or new.cancelled_at is distinct from old.cancelled_at
         or new.cancelled_by is distinct from old.cancelled_by then
        raise exception 'Los campos de workflow se actualizan mediante RPC';
      end if;

      if old.status <> 'DRAFT' then
        raise exception 'Solo las rendiciones en borrador son editables';
      end if;
    elsif v_workflow_action = 'submit' then
      if old.status <> 'DRAFT'
         or new.status <> 'SUBMITTED'
         or new.settlement_number is null
         or new.submitted_by is null
         or new.submitted_at is null
         or new.received_by_name is not null
         or new.received_at is not null
         or new.cancelled_by is not null
         or new.cancelled_at is not null
         or new.prepared_by_name is null then
        raise exception 'Transicion de presentacion invalida';
      end if;
    elsif v_workflow_action = 'receive' then
      if old.status <> 'SUBMITTED'
         or new.status <> 'RECEIVED'
         or new.settlement_number is distinct from old.settlement_number
         or new.submitted_by is distinct from old.submitted_by
         or new.submitted_at is distinct from old.submitted_at
         or new.received_by_name is null
         or new.received_at is null
         or new.cancelled_by is not null
         or new.cancelled_at is not null then
        raise exception 'Transicion de recepcion invalida';
      end if;
    elsif v_workflow_action = 'cancel' then
      if old.status = 'CANCELLED'
         or new.status <> 'CANCELLED'
         or new.settlement_number is distinct from old.settlement_number
         or new.submitted_by is distinct from old.submitted_by
         or new.submitted_at is distinct from old.submitted_at
         or new.received_by_name is distinct from old.received_by_name
         or new.received_at is distinct from old.received_at
         or new.cancelled_by is null
         or new.cancelled_at is null then
        raise exception 'Transicion de anulacion invalida';
      end if;
    else
      raise exception 'Transicion de workflow invalida';
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

  if tg_op = 'UPDATE' then
    if new.settlement_id is distinct from old.settlement_id then
      raise exception 'No se puede cambiar la rendicion de un ingreso';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el creador de un ingreso';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());

    if new.created_by is null then
      raise exception 'El creador del ingreso es obligatorio';
    end if;

    if auth.uid() is not null and new.created_by is distinct from auth.uid() then
      raise exception 'El creador del ingreso debe ser el usuario autenticado';
    end if;
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

  if tg_op = 'UPDATE' then
    if new.settlement_id is distinct from old.settlement_id then
      raise exception 'No se puede cambiar la rendicion de un egreso';
    end if;

    if new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el creador de un egreso';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());

    if new.created_by is null then
      raise exception 'El creador del egreso es obligatorio';
    end if;

    if auth.uid() is not null and new.created_by is distinct from auth.uid() then
      raise exception 'El creador del egreso debe ser el usuario autenticado';
    end if;
  end if;

  new.company_id := v_settlement.company_id;
  new.detail := trim(new.detail);
  new.receipt := nullif(trim(coalesce(new.receipt, '')), '');
  new.supplier_name := nullif(trim(coalesce(new.supplier_name, '')), '');
  new.purchase_order := nullif(trim(coalesce(new.purchase_order, '')), '');

  return new;
end;
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

  if nullif(trim(coalesce(v_settlement.prepared_by_name, '')), '') is null then
    raise exception 'Debes indicar quien preparo la rendicion';
  end if;

  perform pg_advisory_xact_lock(777001, hashtext(v_settlement.company_id::text));

  select coalesce(max(settlement_number), 0) + 1
  into v_next_number
  from public.settlements
  where company_id = v_settlement.company_id
    and settlement_number is not null;

  perform set_config('app.settlement_workflow_action', 'submit', true);

  update public.settlements
  set status = 'SUBMITTED',
      settlement_number = v_next_number,
      submitted_by = v_actor,
      submitted_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  perform set_config('app.settlement_workflow_action', '', true);

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

  perform set_config('app.settlement_workflow_action', 'receive', true);

  update public.settlements
  set status = 'RECEIVED',
      received_by_name = v_received_by_name,
      received_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  perform set_config('app.settlement_workflow_action', '', true);

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

  perform set_config('app.settlement_workflow_action', 'cancel', true);

  update public.settlements
  set status = 'CANCELLED',
      cancelled_by = v_actor,
      cancelled_at = now(),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  perform set_config('app.settlement_workflow_action', '', true);

  return v_settlement;
end;
$$;

drop policy if exists "settlements_insert_company_member" on public.settlements;
create policy "settlements_insert_company_member"
on public.settlements
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.create')
  and created_by = auth.uid()
  and status = 'DRAFT'
  and settlement_number is null
  and submitted_at is null
  and submitted_by is null
  and received_at is null
  and received_by_name is null
  and cancelled_at is null
  and cancelled_by is null
);

drop policy if exists "settlements_update_draft_company_member" on public.settlements;
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
  and submitted_at is null
  and submitted_by is null
  and received_at is null
  and received_by_name is null
  and cancelled_at is null
  and cancelled_by is null
);

drop policy if exists "settlement_income_lines_insert_company_member" on public.settlement_income_lines;
create policy "settlement_income_lines_insert_company_member"
on public.settlement_income_lines
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and created_by = auth.uid()
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

drop policy if exists "settlement_expense_lines_insert_company_member" on public.settlement_expense_lines;
create policy "settlement_expense_lines_insert_company_member"
on public.settlement_expense_lines
for insert
to authenticated
with check (
  public.can_operate_settlement_company(auth.uid(), company_id, 'settlements.edit')
  and created_by = auth.uid()
  and exists (
    select 1
    from public.settlements s
    where s.id = settlement_id
      and s.company_id = company_id
      and s.status = 'DRAFT'
  )
);

notify pgrst, 'reload schema';
