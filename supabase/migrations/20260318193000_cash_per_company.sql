alter table public.cash_closures
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.cash_sales
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.cash_expenses
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.cash_events
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.cash_closures disable trigger trg_cash_closures_prevent_closed_changes;
alter table public.cash_closures disable trigger trg_cash_closures_log_event;
alter table public.cash_sales disable trigger trg_cash_sales_prevent_closed_changes;
alter table public.cash_sales disable trigger trg_cash_sales_log_event;
alter table public.cash_sales disable trigger trg_cash_sales_sync_open_closure;
alter table public.cash_expenses disable trigger trg_cash_expenses_prevent_closed_changes;
alter table public.cash_expenses disable trigger trg_cash_expenses_log_event;
alter table public.cash_expenses disable trigger trg_cash_expenses_sync_open_closure;

do $$
declare
  v_company_id uuid;
begin
  select id
  into v_company_id
  from public.companies
  order by created_at
  limit 1;

  if v_company_id is null then
    raise exception 'No existe una empresa para vincular caja';
  end if;

  update public.cash_closures
  set company_id = v_company_id
  where company_id is null;

  update public.cash_sales
  set company_id = v_company_id
  where company_id is null;

  update public.cash_expenses
  set company_id = v_company_id
  where company_id is null;

  update public.cash_events ce
  set company_id = coalesce(
    (
      select cs.company_id
      from public.cash_sales cs
      where ce.entity_type = 'VENTA'
        and cs.id = ce.entity_id
    ),
    (
      select cex.company_id
      from public.cash_expenses cex
      where ce.entity_type = 'GASTO'
        and cex.id = ce.entity_id
    ),
    (
      select cc.company_id
      from public.cash_closures cc
      where ce.entity_type = 'CIERRE'
        and cc.id = ce.entity_id
    ),
    v_company_id
  )
  where ce.company_id is null;
end
$$;

alter table public.cash_closures enable trigger trg_cash_closures_prevent_closed_changes;
alter table public.cash_closures enable trigger trg_cash_closures_log_event;
alter table public.cash_sales enable trigger trg_cash_sales_prevent_closed_changes;
alter table public.cash_sales enable trigger trg_cash_sales_log_event;
alter table public.cash_sales enable trigger trg_cash_sales_sync_open_closure;
alter table public.cash_expenses enable trigger trg_cash_expenses_prevent_closed_changes;
alter table public.cash_expenses enable trigger trg_cash_expenses_log_event;
alter table public.cash_expenses enable trigger trg_cash_expenses_sync_open_closure;

alter table public.cash_closures
  alter column company_id set not null;

alter table public.cash_sales
  alter column company_id set not null;

alter table public.cash_expenses
  alter column company_id set not null;

alter table public.cash_events
  alter column company_id set not null;

alter table public.cash_closures
  drop constraint if exists cash_closures_business_date_key;

create unique index if not exists cash_closures_company_business_date_key
  on public.cash_closures(company_id, business_date);

drop index if exists cash_closures_status_idx;
create index if not exists cash_closures_status_idx
  on public.cash_closures(company_id, status, business_date desc);

drop index if exists cash_sales_business_date_idx;
create index if not exists cash_sales_business_date_idx
  on public.cash_sales(company_id, business_date desc, sold_at desc);

drop index if exists cash_sales_status_idx;
create index if not exists cash_sales_status_idx
  on public.cash_sales(company_id, status, receipt_kind, payment_method);

drop index if exists cash_expenses_business_date_idx;
create index if not exists cash_expenses_business_date_idx
  on public.cash_expenses(company_id, business_date desc, spent_at desc);

create index if not exists cash_events_company_created_idx
  on public.cash_events(company_id, created_at desc);

drop policy if exists "cash_closures_read_authenticated" on public.cash_closures;
drop policy if exists "cash_closures_insert_owner_or_admin" on public.cash_closures;
drop policy if exists "cash_closures_update_owner_or_admin" on public.cash_closures;
drop policy if exists "cash_closures_delete_owner_or_admin" on public.cash_closures;
drop policy if exists "cash_sales_read_authenticated" on public.cash_sales;
drop policy if exists "cash_sales_insert_owner_or_admin" on public.cash_sales;
drop policy if exists "cash_sales_update_owner_or_admin" on public.cash_sales;
drop policy if exists "cash_sales_delete_owner_or_admin" on public.cash_sales;
drop policy if exists "cash_expenses_read_authenticated" on public.cash_expenses;
drop policy if exists "cash_expenses_insert_owner_or_admin" on public.cash_expenses;
drop policy if exists "cash_expenses_update_owner_or_admin" on public.cash_expenses;
drop policy if exists "cash_expenses_delete_owner_or_admin" on public.cash_expenses;
drop policy if exists "cash_events_read_authenticated" on public.cash_events;
drop policy if exists "cash_events_insert_owner_or_admin" on public.cash_events;

create policy "cash_closures_read_company_member"
on public.cash_closures
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.view')
);

create policy "cash_sales_read_company_member"
on public.cash_sales
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.view')
);

create policy "cash_sales_insert_company_member"
on public.cash_sales
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and public.has_company_permission(auth.uid(), company_id, 'cash.create')
);

create policy "cash_expenses_read_company_member"
on public.cash_expenses
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.view')
);

create policy "cash_expenses_insert_company_member"
on public.cash_expenses
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and public.has_company_permission(auth.uid(), company_id, 'cash.edit')
);

create policy "cash_expenses_update_company_member"
on public.cash_expenses
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.edit')
);

create policy "cash_expenses_delete_company_member"
on public.cash_expenses
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.edit')
);

create policy "cash_events_read_company_member"
on public.cash_events
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'cash.view')
);

create policy "cash_events_insert_company_member"
on public.cash_events
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and (
    public.has_company_permission(auth.uid(), company_id, 'cash.create')
    or public.has_company_permission(auth.uid(), company_id, 'cash.edit')
    or public.has_company_permission(auth.uid(), company_id, 'cash.close')
    or public.has_company_permission(auth.uid(), company_id, 'cash.cancel')
  )
);

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

  if v_doc.company_id <> new.company_id then
    raise exception 'La venta y el remito asociado deben pertenecer a la misma empresa';
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
  v_company_id uuid;
begin
  v_entity_type := case tg_table_name
    when 'cash_sales' then 'VENTA'::public.cash_event_entity_type
    when 'cash_expenses' then 'GASTO'::public.cash_event_entity_type
    else 'CIERRE'::public.cash_event_entity_type
  end;

  v_company_id := coalesce(new.company_id, old.company_id);

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

  insert into public.cash_events (company_id, entity_type, entity_id, event_type, payload, created_by)
  values (v_company_id, v_entity_type, v_entity_id, v_event_type, v_payload, auth.uid());

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
  v_actor uuid := auth.uid();
  v_closure public.cash_closures%rowtype;
  v_cash_sales numeric(14,2);
  v_point_sales numeric(14,2);
  v_transfer_sales numeric(14,2);
  v_account_sales numeric(14,2);
  v_cash_expenses numeric(14,2);
  v_account_expenses numeric(14,2);
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para recalcular caja';
  end if;

  select *
  into v_closure
  from public.cash_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception 'Cierre diario no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_closure.company_id, 'cash.view') then
    raise exception 'No tienes permisos para recalcular caja';
  end if;

  select
    coalesce(sum(case when payment_method = 'EFECTIVO' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'POINT' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'TRANSFERENCIA' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'CUENTA_CORRIENTE' and status <> 'ANULADA' then amount_total else 0 end), 0)
  into v_cash_sales, v_point_sales, v_transfer_sales, v_account_sales
  from public.cash_sales
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

  select
    coalesce(sum(case when expense_kind = 'CAJA' and cancelled_at is null then amount_total else 0 end), 0),
    coalesce(sum(case when expense_kind = 'CUENTA_CORRIENTE' and cancelled_at is null then amount_total else 0 end), 0)
  into v_cash_expenses, v_account_expenses
  from public.cash_expenses
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

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
  v_company_id uuid;
  v_closure_id uuid;
begin
  v_business_date := coalesce(new.business_date, old.business_date);
  v_company_id := coalesce(new.company_id, old.company_id);

  select id
  into v_closure_id
  from public.cash_closures
  where company_id = v_company_id
    and business_date = v_business_date
    and status = 'ABIERTO'
  limit 1;

  if v_closure_id is not null then
    perform public.recalculate_cash_closure_totals(v_closure_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop function if exists public.get_or_create_cash_closure(date);
create or replace function public.get_or_create_cash_closure(
  p_business_date date,
  p_company_id uuid
)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_closure public.cash_closures%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para operar caja';
  end if;

  if p_company_id is null then
    raise exception 'Debes seleccionar una empresa para operar caja';
  end if;

  if not public.has_company_permission(v_actor, p_company_id, 'cash.view') then
    raise exception 'No tienes permisos para operar caja';
  end if;

  insert into public.cash_closures (company_id, business_date, responsible_id, created_by)
  values (p_company_id, p_business_date, v_actor, v_actor)
  on conflict (company_id, business_date) do nothing;

  select *
  into v_closure
  from public.cash_closures
  where company_id = p_company_id
    and business_date = p_business_date;

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
  v_actor uuid := auth.uid();
  v_sale public.cash_sales%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para asociar comprobantes';
  end if;

  select *
  into v_sale
  from public.cash_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if not public.has_company_permission(v_actor, v_sale.company_id, 'cash.edit') then
    raise exception 'No tienes permisos para asociar comprobantes';
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
  v_actor uuid := auth.uid();
  v_sale public.cash_sales%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para anular ventas';
  end if;

  select *
  into v_sale
  from public.cash_sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if not public.has_company_permission(v_actor, v_sale.company_id, 'cash.cancel') then
    raise exception 'No tienes permisos para anular ventas';
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
  v_actor uuid := auth.uid();
  v_closure public.cash_closures%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para cerrar caja';
  end if;

  select *
  into v_closure
  from public.cash_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception 'Cierre diario no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_closure.company_id, 'cash.close') then
    raise exception 'No tienes permisos para cerrar caja';
  end if;

  if v_closure.status = 'CERRADO' then
    raise exception 'El cierre diario ya esta cerrado';
  end if;

  update public.cash_sales
  set closure_id = v_closure.id
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date
    and closure_id is null;

  update public.cash_expenses
  set closure_id = v_closure.id
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date
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

revoke all on function public.get_or_create_cash_closure(date, uuid) from public;
grant execute on function public.get_or_create_cash_closure(date, uuid) to authenticated;

revoke all on function public.recalculate_cash_closure_totals(uuid) from public;
grant execute on function public.recalculate_cash_closure_totals(uuid) to authenticated;

revoke all on function public.attach_cash_sale_receipt(uuid, public.cash_receipt_kind, uuid, text) from public;
grant execute on function public.attach_cash_sale_receipt(uuid, public.cash_receipt_kind, uuid, text) to authenticated;

revoke all on function public.cancel_cash_sale(uuid, text) from public;
grant execute on function public.cancel_cash_sale(uuid, text) to authenticated;

revoke all on function public.close_cash_closure(uuid, numeric, numeric, numeric, text) from public;
grant execute on function public.close_cash_closure(uuid, numeric, numeric, numeric, text) to authenticated;
