drop trigger if exists update_cash_closures_updated_at on public.cash_closures;
create trigger update_cash_closures_updated_at
before update on public.cash_closures
for each row execute function public.update_updated_at_column();

drop trigger if exists update_cash_sales_updated_at on public.cash_sales;
create trigger update_cash_sales_updated_at
before update on public.cash_sales
for each row execute function public.update_updated_at_column();

drop trigger if exists update_cash_expenses_updated_at on public.cash_expenses;
create trigger update_cash_expenses_updated_at
before update on public.cash_expenses
for each row execute function public.update_updated_at_column();

create or replace function public.sync_cash_sale_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'ANULADA' then
    if new.cancelled_at is null then
      new.cancelled_at := now();
    end if;

    if new.cancelled_by is null then
      new.cancelled_by := auth.uid();
    end if;

    return new;
  end if;

  new.cancelled_at := null;
  new.cancelled_by := null;

  if new.receipt_kind = 'PENDIENTE' then
    new.document_id := null;
    new.receipt_reference := null;
    new.status := 'PENDIENTE_COMPROBANTE';
  else
    new.status := 'COMPROBANTADA';
  end if;

  return new;
end;
$$;

create or replace function public.validate_cash_sale_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  if new.document_id is null then
    return new;
  end if;

  select *
  into v_doc
  from public.documents
  where id = new.document_id;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede asociar un remito a la venta';
  end if;

  if v_doc.status = 'ANULADO' then
    raise exception 'No se puede asociar un remito anulado';
  end if;

  if new.receipt_kind <> 'REMITO' then
    raise exception 'El documento asociado exige comprobante tipo remito';
  end if;

  if new.business_date <> v_doc.issue_date then
    raise exception 'La fecha de la venta debe coincidir con la fecha del remito asociado';
  end if;

  if coalesce(new.customer_id, '00000000-0000-0000-0000-000000000000'::uuid) <>
     coalesce(v_doc.customer_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    if new.customer_id is not null and v_doc.customer_id is not null then
      raise exception 'La venta y el remito asociado deben pertenecer al mismo cliente';
    end if;
  end if;

  if nullif(btrim(coalesce(new.receipt_reference, '')), '') is null and v_doc.document_number is not null then
    new.receipt_reference := format(
      '%s-%s',
      lpad(v_doc.point_of_sale::text, 4, '0'),
      lpad(v_doc.document_number::text, 8, '0')
    );
  end if;

  if new.customer_id is null and v_doc.customer_id is not null then
    new.customer_id := v_doc.customer_id;
  end if;

  if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
    new.customer_name_snapshot := coalesce(v_doc.customer_name, new.customer_name_snapshot);
  end if;

  return new;
end;
$$;

create or replace function public.prevent_changes_on_closed_cash_closure()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.cash_closure_status;
begin
  if tg_table_name = 'cash_closures' then
    if tg_op = 'UPDATE' and old.status = 'CERRADO' then
      raise exception 'El cierre diario ya esta cerrado y no admite modificaciones';
    end if;

    if tg_op = 'DELETE' and old.status = 'CERRADO' then
      raise exception 'No se puede eliminar un cierre diario cerrado';
    end if;

    return coalesce(new, old);
  end if;

  if old.closure_id is null then
    return coalesce(new, old);
  end if;

  select status
  into v_status
  from public.cash_closures
  where id = old.closure_id;

  if v_status = 'CERRADO' then
    raise exception 'No se puede modificar un movimiento incluido en un cierre cerrado';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.log_cash_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entity_type public.cash_event_entity_type;
  v_entity_id uuid;
  v_event_type text;
  v_payload jsonb;
begin
  v_entity_type := case tg_table_name
    when 'cash_sales' then 'VENTA'::public.cash_event_entity_type
    when 'cash_expenses' then 'GASTO'::public.cash_event_entity_type
    else 'CIERRE'::public.cash_event_entity_type
  end;

  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_event_type := case tg_table_name
      when 'cash_sales' then 'VENTA_CREADA'
      when 'cash_expenses' then 'GASTO_CREADO'
      else 'CIERRE_CREADO'
    end;
    v_payload := jsonb_build_object('current', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_event_type := case
      when tg_table_name = 'cash_sales' and old.status <> 'ANULADA' and new.status = 'ANULADA' then 'VENTA_ANULADA'
      when tg_table_name = 'cash_expenses' and old.cancelled_at is null and new.cancelled_at is not null then 'GASTO_ANULADO'
      when tg_table_name = 'cash_closures' and old.status <> 'CERRADO' and new.status = 'CERRADO' then 'CIERRE_CERRADO'
      else case tg_table_name
        when 'cash_sales' then 'VENTA_ACTUALIZADA'
        when 'cash_expenses' then 'GASTO_ACTUALIZADO'
        else 'CIERRE_ACTUALIZADO'
      end
    end;
    v_payload := jsonb_build_object(
      'previous', to_jsonb(old),
      'current', to_jsonb(new)
    );
  else
    v_entity_id := old.id;
    v_event_type := case tg_table_name
      when 'cash_sales' then 'VENTA_ELIMINADA'
      when 'cash_expenses' then 'GASTO_ELIMINADO'
      else 'CIERRE_ELIMINADO'
    end;
    v_payload := jsonb_build_object('previous', to_jsonb(old));
  end if;

  insert into public.cash_events (entity_type, entity_id, event_type, payload, created_by)
  values (v_entity_type, v_entity_id, v_event_type, v_payload, auth.uid());

  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_cash_closure_totals(p_closure_id uuid)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure public.cash_closures%rowtype;
  v_cash_sales numeric(14,2);
  v_point_sales numeric(14,2);
  v_transfer_sales numeric(14,2);
  v_account_sales numeric(14,2);
  v_cash_expenses numeric(14,2);
  v_account_expenses numeric(14,2);
begin
  select *
  into v_closure
  from public.cash_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception 'Cierre diario no encontrado';
  end if;

  select
    coalesce(sum(case when payment_method = 'EFECTIVO' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'POINT' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'TRANSFERENCIA' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'CUENTA_CORRIENTE' and status <> 'ANULADA' then amount_total else 0 end), 0)
  into v_cash_sales, v_point_sales, v_transfer_sales, v_account_sales
  from public.cash_sales
  where business_date = v_closure.business_date;

  select
    coalesce(sum(case when expense_kind = 'CAJA' and cancelled_at is null then amount_total else 0 end), 0),
    coalesce(sum(case when expense_kind = 'CUENTA_CORRIENTE' and cancelled_at is null then amount_total else 0 end), 0)
  into v_cash_expenses, v_account_expenses
  from public.cash_expenses
  where business_date = v_closure.business_date;

  update public.cash_closures
  set
    expected_cash_sales_total = v_cash_sales,
    expected_point_sales_total = v_point_sales,
    expected_transfer_sales_total = v_transfer_sales,
    expected_account_sales_total = v_account_sales,
    expected_cash_expenses_total = v_cash_expenses,
    expected_account_expenses_total = v_account_expenses,
    expected_sales_total = v_cash_sales + v_point_sales + v_transfer_sales + v_account_sales,
    expected_cash_to_render = v_cash_sales - v_cash_expenses,
    expected_non_cash_total = v_point_sales + v_transfer_sales + v_account_sales,
    cash_difference = case
      when counted_cash_total is null then null
      else counted_cash_total - (v_cash_sales - v_cash_expenses)
    end,
    point_difference = case
      when counted_point_total is null then null
      else counted_point_total - v_point_sales
    end,
    transfer_difference = case
      when counted_transfer_total is null then null
      else counted_transfer_total - v_transfer_sales
    end
  where id = v_closure.id
  returning * into v_closure;

  return v_closure;
end;
$$;

create or replace function public.sync_open_cash_closure_totals()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_business_date date;
  v_closure_id uuid;
begin
  v_business_date := coalesce(new.business_date, old.business_date);

  select id
  into v_closure_id
  from public.cash_closures
  where business_date = v_business_date
    and status = 'ABIERTO'
  limit 1;

  if v_closure_id is not null then
    perform public.recalculate_cash_closure_totals(v_closure_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.get_or_create_cash_closure(p_business_date date)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure public.cash_closures%rowtype;
begin
  insert into public.cash_closures (business_date, responsible_id, created_by)
  values (p_business_date, auth.uid(), auth.uid())
  on conflict (business_date) do nothing;

  select *
  into v_closure
  from public.cash_closures
  where business_date = p_business_date;

  return public.recalculate_cash_closure_totals(v_closure.id);
end;
$$;

create or replace function public.attach_cash_sale_receipt(
  p_sale_id uuid,
  p_receipt_kind public.cash_receipt_kind,
  p_document_id uuid default null,
  p_receipt_reference text default null
)
returns public.cash_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.cash_sales%rowtype;
begin
  select *
  into v_sale
  from public.cash_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.status = 'ANULADA' then
    raise exception 'No se puede asociar comprobante a una venta anulada';
  end if;

  update public.cash_sales
  set
    receipt_kind = p_receipt_kind,
    document_id = p_document_id,
    receipt_reference = nullif(btrim(coalesce(p_receipt_reference, '')), '')
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

create or replace function public.cancel_cash_sale(
  p_sale_id uuid,
  p_reason text default null
)
returns public.cash_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.cash_sales%rowtype;
begin
  select *
  into v_sale
  from public.cash_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.status = 'ANULADA' then
    return v_sale;
  end if;

  update public.cash_sales
  set
    status = 'ANULADA',
    notes = case
      when nullif(btrim(coalesce(p_reason, '')), '') is null then notes
      when nullif(btrim(coalesce(notes, '')), '') is null then p_reason
      else notes || E'\n' || p_reason
    end
  where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

create or replace function public.close_cash_closure(
  p_closure_id uuid,
  p_counted_cash_total numeric(14,2),
  p_counted_point_total numeric(14,2) default null,
  p_counted_transfer_total numeric(14,2) default null,
  p_notes text default null
)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure public.cash_closures%rowtype;
begin
  select *
  into v_closure
  from public.cash_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception 'Cierre diario no encontrado';
  end if;

  if v_closure.status = 'CERRADO' then
    raise exception 'El cierre diario ya esta cerrado';
  end if;

  update public.cash_sales
  set closure_id = v_closure.id
  where business_date = v_closure.business_date
    and closure_id is null;

  update public.cash_expenses
  set closure_id = v_closure.id
  where business_date = v_closure.business_date
    and closure_id is null;

  v_closure := public.recalculate_cash_closure_totals(v_closure.id);

  update public.cash_closures
  set
    counted_cash_total = p_counted_cash_total,
    counted_point_total = p_counted_point_total,
    counted_transfer_total = p_counted_transfer_total,
    notes = p_notes,
    status = 'CERRADO',
    closed_at = now(),
    cash_difference = p_counted_cash_total - v_closure.expected_cash_to_render,
    point_difference = case
      when p_counted_point_total is null then null
      else p_counted_point_total - v_closure.expected_point_sales_total
    end,
    transfer_difference = case
      when p_counted_transfer_total is null then null
      else p_counted_transfer_total - v_closure.expected_transfer_sales_total
    end
  where id = v_closure.id
  returning * into v_closure;

  return v_closure;
end;
$$;

drop trigger if exists trg_cash_sales_sync_status on public.cash_sales;
create trigger trg_cash_sales_sync_status
before insert or update on public.cash_sales
for each row execute function public.sync_cash_sale_status();

drop trigger if exists trg_cash_sales_validate_document on public.cash_sales;
create trigger trg_cash_sales_validate_document
before insert or update on public.cash_sales
for each row execute function public.validate_cash_sale_document();

drop trigger if exists trg_cash_sales_prevent_closed_changes on public.cash_sales;
create trigger trg_cash_sales_prevent_closed_changes
before update or delete on public.cash_sales
for each row execute function public.prevent_changes_on_closed_cash_closure();

drop trigger if exists trg_cash_expenses_prevent_closed_changes on public.cash_expenses;
create trigger trg_cash_expenses_prevent_closed_changes
before update or delete on public.cash_expenses
for each row execute function public.prevent_changes_on_closed_cash_closure();

drop trigger if exists trg_cash_closures_prevent_closed_changes on public.cash_closures;
create trigger trg_cash_closures_prevent_closed_changes
before update or delete on public.cash_closures
for each row execute function public.prevent_changes_on_closed_cash_closure();

drop trigger if exists trg_cash_sales_sync_open_closure on public.cash_sales;
create trigger trg_cash_sales_sync_open_closure
after insert or update or delete on public.cash_sales
for each row execute function public.sync_open_cash_closure_totals();

drop trigger if exists trg_cash_expenses_sync_open_closure on public.cash_expenses;
create trigger trg_cash_expenses_sync_open_closure
after insert or update or delete on public.cash_expenses
for each row execute function public.sync_open_cash_closure_totals();

drop trigger if exists trg_cash_sales_log_event on public.cash_sales;
create trigger trg_cash_sales_log_event
after insert or update or delete on public.cash_sales
for each row execute function public.log_cash_event();

drop trigger if exists trg_cash_expenses_log_event on public.cash_expenses;
create trigger trg_cash_expenses_log_event
after insert or update or delete on public.cash_expenses
for each row execute function public.log_cash_event();

drop trigger if exists trg_cash_closures_log_event on public.cash_closures;
create trigger trg_cash_closures_log_event
after insert or update or delete on public.cash_closures
for each row execute function public.log_cash_event();
