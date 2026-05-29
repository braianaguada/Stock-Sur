create table if not exists public.cash_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  business_date date not null,
  occurred_at timestamptz not null default now(),
  document_id uuid not null references public.documents(id),
  adjustment_kind text not null default 'REMITO_DEVOLUCION',
  payment_method public.cash_payment_method not null default 'SERVICIOS_REMITO',
  amount_total numeric(14,2) not null,
  signed_amount numeric(14,2) not null,
  customer_id uuid null references public.customers(id),
  customer_name_snapshot text null,
  closure_id uuid null references public.cash_closures(id) on delete set null,
  notes text null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_adjustments_kind_check check (adjustment_kind = 'REMITO_DEVOLUCION'),
  constraint cash_adjustments_payment_check check (payment_method = 'SERVICIOS_REMITO'),
  constraint cash_adjustments_amount_positive_check check (amount_total > 0),
  constraint cash_adjustments_signed_amount_check check (signed_amount = -amount_total),
  constraint cash_adjustments_cancelled_metadata_check check (
    (cancelled_at is null and cancelled_by is null)
    or (cancelled_at is not null and cancelled_by is not null)
  )
);

create unique index if not exists cash_adjustments_active_document_uidx
  on public.cash_adjustments(document_id)
  where cancelled_at is null;

create index if not exists cash_adjustments_company_business_date_idx
  on public.cash_adjustments(company_id, business_date desc, occurred_at desc);

create index if not exists cash_adjustments_closure_idx
  on public.cash_adjustments(closure_id)
  where closure_id is not null;

create index if not exists cash_adjustments_customer_idx
  on public.cash_adjustments(customer_id)
  where customer_id is not null;

alter table public.cash_adjustments enable row level security;

drop policy if exists "cash_adjustments_read_company" on public.cash_adjustments;
drop policy if exists "cash_adjustments_insert_company" on public.cash_adjustments;
drop policy if exists "cash_adjustments_update_company" on public.cash_adjustments;
drop policy if exists "cash_adjustments_delete_company" on public.cash_adjustments;

create policy "cash_adjustments_read_company" on public.cash_adjustments
for select to authenticated
using (public.has_company_permission(auth.uid(), company_id, 'cash.view'));

create policy "cash_adjustments_insert_company" on public.cash_adjustments
for insert to authenticated
with check (public.has_company_permission(auth.uid(), company_id, 'cash.create'));

create policy "cash_adjustments_update_company" on public.cash_adjustments
for update to authenticated
using (public.has_company_permission(auth.uid(), company_id, 'cash.edit'))
with check (public.has_company_permission(auth.uid(), company_id, 'cash.edit'));

create policy "cash_adjustments_delete_company" on public.cash_adjustments
for delete to authenticated
using (public.has_company_permission(auth.uid(), company_id, 'cash.cancel'));

create or replace function public.validate_cash_adjustment_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_doc_business_date date;
begin
  select *
  into v_doc
  from public.documents
  where id = new.document_id;

  if not found then
    raise exception 'Documento de devolucion no encontrado';
  end if;

  v_doc_business_date := coalesce(
    v_doc.issue_date,
    (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date
  );

  if v_doc.company_id <> new.company_id then
    raise exception 'El ajuste de caja y la devolucion deben pertenecer a la misma empresa';
  end if;

  if v_doc.doc_type <> 'REMITO_DEVOLUCION' then
    raise exception 'Solo se puede asociar un remito devolucion como ajuste';
  end if;

  if v_doc.status <> 'EMITIDO' then
    raise exception 'Solo se pueden asociar devoluciones emitidas';
  end if;

  if new.business_date <> v_doc_business_date then
    raise exception 'La fecha de caja debe coincidir con la fecha de emision de la devolucion';
  end if;

  new.adjustment_kind := 'REMITO_DEVOLUCION';
  new.payment_method := 'SERVICIOS_REMITO';
  new.amount_total := coalesce(new.amount_total, v_doc.total);
  new.signed_amount := -new.amount_total;

  if new.customer_id is null and v_doc.customer_id is not null then
    new.customer_id := v_doc.customer_id;
  end if;

  if nullif(btrim(coalesce(new.customer_name_snapshot, '')), '') is null then
    new.customer_name_snapshot := coalesce(v_doc.customer_name, 'Cliente ocasional');
  end if;

  return new;
end;
$$;

drop trigger if exists update_cash_adjustments_updated_at on public.cash_adjustments;
create trigger update_cash_adjustments_updated_at
before update on public.cash_adjustments
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_cash_adjustments_validate_document on public.cash_adjustments;
create trigger trg_cash_adjustments_validate_document
before insert or update on public.cash_adjustments
for each row execute function public.validate_cash_adjustment_document();

drop trigger if exists trg_cash_adjustments_prevent_closed_changes on public.cash_adjustments;
create trigger trg_cash_adjustments_prevent_closed_changes
before update or delete on public.cash_adjustments
for each row execute function public.prevent_changes_on_closed_cash_closure();

drop trigger if exists trg_cash_adjustments_sync_open_closure on public.cash_adjustments;
create trigger trg_cash_adjustments_sync_open_closure
after insert or update or delete on public.cash_adjustments
for each row execute function public.sync_open_cash_closure_totals();

create or replace function public.register_customer_account_credit_from_document(
  p_document_id uuid
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_origin public.documents%rowtype;
  v_customer public.customers%rowtype;
  v_ref text;
begin
  select *
  into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO_DEVOLUCION' or v_doc.status <> 'EMITIDO' then
    return null;
  end if;

  if v_doc.customer_id is null or v_doc.origin_document_id is null then
    return null;
  end if;

  select *
  into v_origin
  from public.documents
  where id = v_doc.origin_document_id
    and company_id = v_doc.company_id
  for share;

  if not found then
    raise exception 'Remito original no encontrado';
  end if;

  if v_origin.doc_type <> 'REMITO'
     or v_origin.status <> 'EMITIDO'
     or v_origin.customer_id is null
     or v_origin.customer_id <> v_doc.customer_id
     or upper(btrim(coalesce(v_origin.payment_terms, ''))) <> 'CUENTA_CORRIENTE' then
    return null;
  end if;

  select *
  into v_customer
  from public.customers
  where id = v_doc.customer_id
    and company_id = v_doc.company_id;

  if not found or v_customer.is_occasional then
    return null;
  end if;

  v_ref := format(
    'REMITO_DEVOLUCION %s-%s',
    lpad(v_doc.point_of_sale::text, 4, '0'),
    lpad(v_doc.document_number::text, 8, '0')
  );

  return public.record_customer_account_entry(
    v_doc.company_id,
    v_doc.customer_id,
    'CREDIT',
    'DOCUMENT',
    v_doc.id,
    v_doc.total,
    format('Credito por %s', v_ref),
    v_doc.issue_date,
    null,
    jsonb_build_object(
      'source', 'issue_document',
      'reference', v_ref,
      'origin_document_id', v_doc.origin_document_id
    ),
    v_doc.id,
    null
  );
end;
$$;

create or replace function public.register_customer_account_debit_reversal_from_return_cancel(
  p_document_id uuid
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_credit public.customer_account_entries%rowtype;
  v_ref text;
begin
  select *
  into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO_DEVOLUCION' then
    return null;
  end if;

  select *
  into v_credit
  from public.customer_account_entries e
  where e.company_id = v_doc.company_id
    and e.document_id = v_doc.id
    and e.origin_type = 'DOCUMENT'
    and e.origin_id = v_doc.id
    and e.entry_type = 'CREDIT'
  limit 1;

  if not found then
    return null;
  end if;

  v_ref := format(
    'ANULACION REMITO_DEVOLUCION %s-%s',
    lpad(v_doc.point_of_sale::text, 4, '0'),
    lpad(v_doc.document_number::text, 8, '0')
  );

  return public.record_customer_account_entry(
    v_doc.company_id,
    v_doc.customer_id,
    'DEBIT',
    'DOCUMENT',
    v_doc.id,
    v_doc.total,
    format('Reversa de credito por %s', v_ref),
    coalesce(v_doc.issue_date, now()::date),
    null,
    jsonb_build_object(
      'source', 'cancel_return_document',
      'reference', v_ref,
      'origin_document_id', v_doc.origin_document_id,
      'reverses_entry_id', v_credit.id
    ),
    v_doc.id,
    null
  );
end;
$$;

create or replace function public.register_cash_adjustment_from_return(
  p_document_id uuid,
  p_business_date date default null,
  p_notes text default null
)
returns public.cash_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_business_date date;
  v_closure public.cash_closures%rowtype;
  v_adjustment public.cash_adjustments%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar devoluciones en caja';
  end if;

  select *
  into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento de devolucion no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_doc.company_id, 'cash.create') then
    raise exception 'No tienes permisos para registrar devoluciones en caja';
  end if;

  if v_doc.doc_type <> 'REMITO_DEVOLUCION' then
    raise exception 'Solo se puede registrar una devolucion de remito';
  end if;

  if v_doc.status <> 'EMITIDO' then
    raise exception 'Solo se pueden registrar devoluciones emitidas';
  end if;

  v_business_date := coalesce(
    p_business_date,
    v_doc.issue_date,
    (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date
  );

  if v_business_date <> coalesce(v_doc.issue_date, (v_doc.created_at at time zone 'America/Argentina/Buenos_Aires')::date) then
    raise exception 'La fecha de caja debe coincidir con la fecha de emision de la devolucion';
  end if;

  select *
  into v_closure
  from public.cash_closures
  where company_id = v_doc.company_id
    and business_date = v_business_date;

  if found and v_closure.status = 'CERRADO' then
    raise exception 'El cierre diario ya esta cerrado y no admite devoluciones';
  end if;

  if not found then
    v_closure := public.get_or_create_cash_closure(v_business_date, v_doc.company_id);
  end if;

  perform 1
  from public.cash_adjustments ca
  where ca.document_id = v_doc.id
    and ca.cancelled_at is null;

  if found then
    raise exception 'Esta devolucion ya fue registrada en caja';
  end if;

  insert into public.cash_adjustments (
    company_id,
    business_date,
    occurred_at,
    document_id,
    adjustment_kind,
    payment_method,
    amount_total,
    signed_amount,
    customer_id,
    customer_name_snapshot,
    notes,
    created_by
  )
  values (
    v_doc.company_id,
    v_business_date,
    now(),
    v_doc.id,
    'REMITO_DEVOLUCION',
    'SERVICIOS_REMITO',
    v_doc.total,
    -v_doc.total,
    v_doc.customer_id,
    coalesce(v_doc.customer_name, 'Cliente ocasional'),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_actor
  )
  returning * into v_adjustment;

  perform public.recalculate_cash_closure_totals(v_closure.id);

  return v_adjustment;
end;
$$;

create or replace function public.cancel_cash_adjustment(
  p_adjustment_id uuid,
  p_reason text default null
)
returns public.cash_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_adjustment public.cash_adjustments%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para anular ajustes de caja';
  end if;

  select *
  into v_adjustment
  from public.cash_adjustments
  where id = p_adjustment_id
  for update;

  if not found then
    raise exception 'Ajuste de caja no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_adjustment.company_id, 'cash.cancel') then
    raise exception 'No tienes permisos para anular ajustes de caja';
  end if;

  if v_adjustment.cancelled_at is not null then
    return v_adjustment;
  end if;

  update public.cash_adjustments
  set
    cancelled_at = now(),
    cancelled_by = v_actor,
    notes = case
      when nullif(btrim(coalesce(p_reason, '')), '') is null then notes
      when nullif(btrim(coalesce(notes, '')), '') is null then p_reason
      else notes || E'\n' || p_reason
    end
  where id = p_adjustment_id
  returning * into v_adjustment;

  return v_adjustment;
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
  v_cash_remito_sales numeric(14,2);
  v_cash_facturable_sales numeric(14,2);
  v_services_remito_sales numeric(14,2);
  v_services_remito_adjustments numeric(14,2);
  v_point_sales numeric(14,2);
  v_transfer_sales numeric(14,2);
  v_account_sales numeric(14,2);
  v_cash_expenses numeric(14,2);
  v_account_expenses numeric(14,2);
  v_cash_sales numeric(14,2);
  v_services_remito_total numeric(14,2);
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
    coalesce(sum(case when payment_method in ('EFECTIVO', 'EFECTIVO_REMITO') and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'EFECTIVO_FACTURABLE' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'SERVICIOS_REMITO' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'POINT' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'TRANSFERENCIA' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'CUENTA_CORRIENTE' and status <> 'ANULADA' then amount_total else 0 end), 0)
  into
    v_cash_remito_sales,
    v_cash_facturable_sales,
    v_services_remito_sales,
    v_point_sales,
    v_transfer_sales,
    v_account_sales
  from public.cash_sales
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

  select coalesce(sum(signed_amount), 0)
  into v_services_remito_adjustments
  from public.cash_adjustments
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date
    and payment_method = 'SERVICIOS_REMITO'
    and cancelled_at is null;

  v_cash_sales := v_cash_remito_sales + v_cash_facturable_sales;
  v_services_remito_total := v_services_remito_sales + v_services_remito_adjustments;

  select
    coalesce(sum(case when expense_kind = 'CAJA' and cancelled_at is null then amount_total else 0 end), 0),
    coalesce(sum(case when expense_kind = 'CUENTA_CORRIENTE' and cancelled_at is null then amount_total else 0 end), 0)
  into v_cash_expenses, v_account_expenses
  from public.cash_expenses
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

  update public.cash_closures
  set
    expected_cash_remito_total = v_cash_remito_sales,
    expected_cash_facturable_total = v_cash_facturable_sales,
    expected_services_remito_total = v_services_remito_total,
    expected_cash_sales_total = v_cash_sales,
    expected_point_sales_total = v_point_sales,
    expected_transfer_sales_total = v_transfer_sales,
    expected_account_sales_total = v_account_sales,
    expected_cash_expenses_total = v_cash_expenses,
    expected_account_expenses_total = v_account_expenses,
    expected_sales_total = v_cash_sales + v_services_remito_total + v_point_sales + v_transfer_sales + v_account_sales,
    expected_cash_to_render = v_cash_sales - v_cash_expenses,
    expected_non_cash_total = v_services_remito_total + v_point_sales + v_transfer_sales + v_account_sales,
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

  update public.cash_adjustments
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

create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_next integer;
  v_line record;
  v_available numeric;
  v_ref text;
  v_origin_line record;
  v_original_qty numeric;
  v_returned_qty numeric;
  v_available_to_return numeric;
  v_allow_without_stock boolean := false;
  v_stock_shortages jsonb := '[]'::jsonb;
  v_is_account_document boolean := false;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para emitir documentos';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_doc.company_id, 'documents.issue') then
    raise exception 'No tienes permisos para emitir documentos';
  end if;

  if v_doc.doc_type not in ('REMITO', 'REMITO_DEVOLUCION') then
    raise exception 'Solo los remitos se emiten';
  end if;

  if v_doc.status <> 'BORRADOR' then
    raise exception 'Solo se pueden emitir remitos en borrador';
  end if;

  if v_doc.doc_type = 'REMITO' and v_doc.customer_kind = 'INTERNO' and v_doc.internal_remito_type is null then
    raise exception 'El remito interno requiere tipo de imputacion';
  end if;

  if v_doc.doc_type = 'REMITO_DEVOLUCION' then
    if v_doc.origin_document_id is null then
      raise exception 'La devolucion debe referenciar un remito original';
    end if;
    if v_doc.technician_id is null then
      raise exception 'La devolucion debe estar asociada a un tecnico';
    end if;
  end if;

  if not exists (select 1 from public.document_lines where document_id = v_doc.id) then
    raise exception 'No se puede emitir un documento sin lineas';
  end if;

  if v_doc.doc_type = 'REMITO_DEVOLUCION' then
    select *
    into v_origin_line
    from public.documents origin
    where origin.id = v_doc.origin_document_id
      and origin.company_id = v_doc.company_id
      and origin.doc_type = 'REMITO'
      and origin.status = 'EMITIDO'
      and origin.technician_id = v_doc.technician_id
    for update;

    if not found then
      raise exception 'La devolucion debe referenciar un remito emitido del mismo tecnico';
    end if;

    for v_line in
      select dl.item_id, dl.quantity, dl.description
      from public.document_lines dl
      where dl.document_id = v_doc.id
      order by dl.line_order
    loop
      if v_line.item_id is null then
        raise exception 'La devolucion requiere item asociado en todas las lineas';
      end if;

      if coalesce(v_line.quantity, 0) <= 0 then
        raise exception 'Cantidad invalida en una linea de la devolucion';
      end if;

      select coalesce(sum(dl.quantity), 0)
      into v_original_qty
      from public.document_lines dl
      where dl.document_id = v_doc.origin_document_id
        and dl.item_id = v_line.item_id;

      select coalesce(sum(dl.quantity), 0)
      into v_returned_qty
      from public.document_lines dl
      join public.documents d on d.id = dl.document_id
      where d.origin_document_id = v_doc.origin_document_id
        and d.doc_type = 'REMITO_DEVOLUCION'
        and d.status = 'EMITIDO'
        and dl.item_id = v_line.item_id;

      v_available_to_return := v_original_qty - v_returned_qty;

      if v_line.quantity > v_available_to_return then
        raise exception 'La devolucion supera lo disponible para % (original: %, ya devuelto: %, maximo: %, solicitado: %)',
          coalesce(v_line.description, 'item'),
          v_original_qty,
          v_returned_qty,
          v_available_to_return,
          v_line.quantity;
      end if;
    end loop;
  else
    select coalesce(cs.allow_issue_remitos_without_stock, false)
    into v_allow_without_stock
    from public.company_settings cs
    where cs.company_id = v_doc.company_id;

    for v_line in
      select dl.item_id, dl.quantity, dl.description
      from public.document_lines dl
      where dl.document_id = v_doc.id
      order by dl.line_order
    loop
      if v_line.item_id is null then
        raise exception 'El remito requiere item asociado en todas las lineas';
      end if;

      if coalesce(v_line.quantity, 0) <= 0 then
        raise exception 'Cantidad invalida en una linea del remito';
      end if;

      select coalesce(sum(
        case sm.type
          when 'IN' then sm.quantity
          when 'OUT' then -sm.quantity
          else sm.quantity
        end
      ), 0)
      into v_available
      from public.stock_movements sm
      where sm.company_id = v_doc.company_id
        and sm.item_id = v_line.item_id;

      if v_available < v_line.quantity then
        if not v_allow_without_stock then
          raise exception 'Stock insuficiente para % (disponible: %, requerido: %)',
            coalesce(v_line.description, 'item'),
            v_available,
            v_line.quantity;
        end if;

        v_stock_shortages := v_stock_shortages || jsonb_build_array(
          jsonb_build_object(
            'item_id', v_line.item_id,
            'description', coalesce(v_line.description, 'item'),
            'available', v_available,
            'required', v_line.quantity
          )
        );
      end if;
    end loop;
  end if;

  insert into public.document_sequences (company_id, doc_type, point_of_sale, last_number)
  values (v_doc.company_id, v_doc.doc_type, v_doc.point_of_sale, 0)
  on conflict (company_id, doc_type, point_of_sale) do nothing;

  update public.document_sequences
  set last_number = last_number + 1, updated_at = now()
  where company_id = v_doc.company_id
    and doc_type = v_doc.doc_type
    and point_of_sale = v_doc.point_of_sale
  returning last_number into v_next;

  update public.documents
  set status = 'EMITIDO',
      document_number = v_next,
      issue_date = coalesce(issue_date, now()::date),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  v_ref := format('%s %s', v_doc.doc_type::text, format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0')));

  if v_doc.doc_type = 'REMITO_DEVOLUCION' then
    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by)
    select
      v_doc.company_id,
      dl.item_id,
      'IN'::public.movement_type,
      dl.quantity,
      v_ref,
      'Ingreso por devolucion de remito',
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  else
    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by)
    select
      v_doc.company_id,
      dl.item_id,
      'OUT'::public.movement_type,
      dl.quantity,
      v_ref,
      'Salida automatica por emision de remito',
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    case when v_doc.doc_type = 'REMITO_DEVOLUCION' then 'REMITO_DEVOLUCION_EMITIDO' else 'REMITO_EMITIDO' end,
    jsonb_build_object(
      'document_number', v_doc.document_number,
      'reference', v_ref,
      'origin_document_id', v_doc.origin_document_id,
      'returned_items', (
        select coalesce(jsonb_agg(jsonb_build_object('item_id', dl.item_id, 'quantity', dl.quantity)), '[]'::jsonb)
        from public.document_lines dl
        where dl.document_id = v_doc.id
      ),
      'issued_without_stock', jsonb_array_length(v_stock_shortages) > 0,
      'stock_shortages', v_stock_shortages
    ),
    v_actor
  );

  select exists (
    select 1
    from public.customers c
    where c.id = v_doc.customer_id
      and c.company_id = v_doc.company_id
      and c.is_occasional = false
  ) into v_is_account_document;

  if v_doc.doc_type = 'REMITO' and v_is_account_document and upper(btrim(coalesce(v_doc.payment_terms, ''))) = 'CUENTA_CORRIENTE' then
    perform public.register_customer_account_debit_from_document(
      v_doc.company_id,
      v_doc.customer_id,
      v_doc.id,
      v_doc.total,
      format('Debito por %s %s', v_doc.doc_type::text, format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0'))),
      null,
      jsonb_build_object('source', 'issue_document', 'reference', v_ref)
    );
  elsif v_doc.doc_type = 'REMITO_DEVOLUCION' then
    perform public.register_customer_account_credit_from_document(v_doc.id);
  end if;

  return v_doc;
end;
$$;

create or replace function public.transition_document_status(
  p_document_id uuid,
  p_target_status public.document_status
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_updated public.documents%rowtype;
  v_ref text;
  v_next integer;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para cambiar el estado de documentos';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if not (
    (p_target_status in ('ENVIADO', 'APROBADO', 'RECHAZADO') and public.has_company_permission(v_actor, v_doc.company_id, 'documents.approve'))
    or (p_target_status = 'ANULADO' and public.has_company_permission(v_actor, v_doc.company_id, 'documents.cancel'))
  ) then
    raise exception 'No tienes permisos para cambiar el estado de documentos';
  end if;

  if v_doc.status = p_target_status then
    return v_doc;
  end if;

  if p_target_status = 'ANULADO' then
    perform 1
    from public.cash_sales
    where company_id = v_doc.company_id
      and status <> 'ANULADA'
      and (
        (document_id is not null and document_id = v_doc.id)
        or (
          v_doc.external_invoice_status = 'ACTIVE'
          and receipt_reference = v_doc.external_invoice_number
        )
      )
    limit 1;

    if found then
      raise exception 'No se puede anular un documento ya usado en caja';
    end if;

    perform 1
    from public.cash_adjustments
    where company_id = v_doc.company_id
      and document_id = v_doc.id
      and cancelled_at is null
    limit 1;

    if found then
      raise exception 'No se puede anular una devolucion ya usada en caja';
    end if;
  end if;

  if v_doc.doc_type = 'PRESUPUESTO' then
    if p_target_status not in ('ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Estado invalido para presupuesto';
    end if;

    if v_doc.status = 'BORRADOR' and p_target_status not in ('ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Transicion invalida';
    end if;

    if v_doc.status = 'ENVIADO' and p_target_status not in ('APROBADO', 'RECHAZADO', 'ANULADO') then
      raise exception 'Transicion invalida';
    end if;

    if v_doc.status = 'APROBADO' and p_target_status <> 'ANULADO' then
      raise exception 'Un presupuesto aprobado solo puede anularse';
    end if;

    if v_doc.status in ('RECHAZADO', 'ANULADO', 'EMITIDO') then
      raise exception 'El presupuesto ya no admite cambios de estado';
    end if;
  elsif v_doc.doc_type in ('REMITO', 'REMITO_DEVOLUCION') then
    if p_target_status <> 'ANULADO' then
      raise exception 'El remito solo puede anularse por esta via';
    end if;

    if v_doc.status not in ('BORRADOR', 'EMITIDO') then
      raise exception 'El remito no puede anularse en su estado actual';
    end if;
  else
    raise exception 'Tipo de documento no soportado';
  end if;

  if v_doc.doc_type = 'PRESUPUESTO'
     and v_doc.status = 'BORRADOR'
     and v_doc.document_number is null
     and p_target_status <> 'ANULADO' then
    insert into public.document_sequences (company_id, doc_type, point_of_sale, last_number)
    values (v_doc.company_id, v_doc.doc_type, v_doc.point_of_sale, 0)
    on conflict (company_id, doc_type, point_of_sale) do nothing;

    update public.document_sequences
    set last_number = last_number + 1, updated_at = now()
    where company_id = v_doc.company_id
      and doc_type = v_doc.doc_type
      and point_of_sale = v_doc.point_of_sale
    returning last_number into v_next;
  end if;

  update public.documents
  set status = p_target_status,
      document_number = coalesce(v_next, document_number),
      updated_at = now()
  where id = v_doc.id
  returning * into v_updated;

  if v_doc.status = 'EMITIDO' and p_target_status = 'ANULADO' and v_doc.doc_type in ('REMITO', 'REMITO_DEVOLUCION') then
    v_ref := format(
      'ANULACION %s %s',
      v_doc.doc_type::text,
      format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0'))
    );

    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by)
    select
      v_doc.company_id,
      dl.item_id,
      case when v_doc.doc_type = 'REMITO_DEVOLUCION' then 'OUT'::public.movement_type else 'IN'::public.movement_type end,
      dl.quantity,
      v_ref,
      case
        when v_doc.doc_type = 'REMITO_DEVOLUCION' then 'Salida automatica por anulacion de devolucion de remito'
        else 'Ingreso automatico por anulacion de remito'
      end,
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;

    if v_doc.doc_type = 'REMITO_DEVOLUCION' then
      perform public.register_customer_account_debit_reversal_from_return_cancel(v_doc.id);
    end if;
  end if;

  if p_target_status = 'ANULADO' then
    insert into public.document_events (document_id, event_type, payload, created_by)
    values (
      v_doc.id,
      'STATUS_CHANGED',
      jsonb_build_object(
        'from', v_doc.status,
        'to', p_target_status,
        'document_number', coalesce(v_updated.document_number, v_doc.document_number)
      ),
      v_actor
    );
  elsif v_doc.doc_type = 'PRESUPUESTO' and p_target_status in ('ENVIADO', 'APROBADO', 'RECHAZADO') then
    insert into public.document_events (document_id, event_type, payload, created_by)
    values (v_doc.id, 'STATUS_CHANGED', jsonb_build_object('to', p_target_status::text), v_actor);
  end if;

  return v_updated;
end;
$$;

revoke all on function public.register_customer_account_credit_from_document(uuid) from public;
grant execute on function public.register_customer_account_credit_from_document(uuid) to authenticated;

revoke all on function public.register_customer_account_debit_reversal_from_return_cancel(uuid) from public;
grant execute on function public.register_customer_account_debit_reversal_from_return_cancel(uuid) to authenticated;

revoke all on function public.register_cash_adjustment_from_return(uuid, date, text) from public;
grant execute on function public.register_cash_adjustment_from_return(uuid, date, text) to authenticated;

revoke all on function public.cancel_cash_adjustment(uuid, text) from public;
grant execute on function public.cancel_cash_adjustment(uuid, text) to authenticated;
