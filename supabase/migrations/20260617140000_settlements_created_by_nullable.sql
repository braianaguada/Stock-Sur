alter table public.settlement_income_lines
  alter column created_by drop not null;

alter table public.settlement_expense_lines
  alter column created_by drop not null;

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

    if new.created_by is distinct from old.created_by
       and not (old.created_by is not null and new.created_by is null and auth.uid() is null) then
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

    if new.created_by is distinct from old.created_by
       and not (old.created_by is not null and new.created_by is null and auth.uid() is null) then
      raise exception 'No se puede cambiar el creador de un ingreso';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'El creador del ingreso es obligatorio';
    end if;

    new.created_by := coalesce(new.created_by, auth.uid());

    if new.created_by is distinct from auth.uid() then
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

    if new.created_by is distinct from old.created_by
       and not (old.created_by is not null and new.created_by is null and auth.uid() is null) then
      raise exception 'No se puede cambiar el creador de un egreso';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'El creador del egreso es obligatorio';
    end if;

    new.created_by := coalesce(new.created_by, auth.uid());

    if new.created_by is distinct from auth.uid() then
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

notify pgrst, 'reload schema';
