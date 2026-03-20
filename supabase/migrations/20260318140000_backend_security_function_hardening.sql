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
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para emitir documentos';
  end if;

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para emitir documentos';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo los remitos se emiten';
  end if;

  if v_doc.status <> 'BORRADOR' then
    raise exception 'Solo se pueden emitir remitos en borrador';
  end if;

  if v_doc.customer_kind = 'INTERNO' and v_doc.internal_remito_type is null then
    raise exception 'El remito interno requiere tipo de imputacion';
  end if;

  if not exists (select 1 from public.document_lines where document_id = v_doc.id) then
    raise exception 'No se puede emitir un documento sin lineas';
  end if;

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
    where sm.item_id = v_line.item_id;

    if v_available < v_line.quantity then
      raise exception 'Stock insuficiente para % (disponible: %, requerido: %)',
        coalesce(v_line.description, 'item'),
        v_available,
        v_line.quantity;
    end if;
  end loop;

  insert into public.document_sequences (doc_type, point_of_sale, last_number)
  values (v_doc.doc_type, v_doc.point_of_sale, 0)
  on conflict (doc_type, point_of_sale) do nothing;

  update public.document_sequences
  set last_number = last_number + 1, updated_at = now()
  where doc_type = v_doc.doc_type and point_of_sale = v_doc.point_of_sale
  returning last_number into v_next;

  update public.documents
  set status = 'EMITIDO',
      document_number = v_next,
      issue_date = coalesce(issue_date, now()::date),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  v_ref := format('%s %s', v_doc.doc_type::text, format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0')));

  insert into public.stock_movements (item_id, type, quantity, reference, notes, created_by)
  select
    dl.item_id,
    'OUT'::public.movement_type,
    dl.quantity,
    v_ref,
    'Salida automatica por emision de remito',
    v_actor
  from public.document_lines dl
  where dl.document_id = v_doc.id and dl.item_id is not null;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'REMITO_EMITIDO',
    jsonb_build_object('document_number', v_doc.document_number, 'reference', v_ref),
    v_actor
  );

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

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para cambiar el estado de documentos';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status = p_target_status then
    return v_doc;
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
  elsif v_doc.doc_type = 'REMITO' then
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
    insert into public.document_sequences (doc_type, point_of_sale, last_number)
    values (v_doc.doc_type, v_doc.point_of_sale, 0)
    on conflict (doc_type, point_of_sale) do nothing;

    update public.document_sequences
    set last_number = last_number + 1, updated_at = now()
    where doc_type = v_doc.doc_type and point_of_sale = v_doc.point_of_sale
    returning last_number into v_next;
  end if;

  update public.documents
  set status = p_target_status,
      document_number = coalesce(v_next, document_number),
      updated_at = now()
  where id = v_doc.id
  returning * into v_updated;

  if v_doc.doc_type = 'REMITO' and v_doc.status = 'EMITIDO' and p_target_status = 'ANULADO' then
    v_ref := format(
      'ANULACION %s %s',
      v_doc.doc_type::text,
      format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0'))
    );

    insert into public.stock_movements (item_id, type, quantity, reference, notes, created_by)
    select
      dl.item_id,
      'IN'::public.movement_type,
      dl.quantity,
      v_ref,
      'Ingreso automatico por anulacion de remito',
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

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

  return v_updated;
end;
$$;

create or replace function public.get_or_create_cash_closure(p_business_date date)
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

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para operar caja';
  end if;

  insert into public.cash_closures (business_date, responsible_id, created_by)
  values (p_business_date, v_actor, v_actor)
  on conflict (business_date) do nothing;

  select *
  into v_closure
  from public.cash_closures
  where business_date = p_business_date;

  return public.recalculate_cash_closure_totals(v_closure.id);
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

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para recalcular caja';
  end if;

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

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para asociar comprobantes';
  end if;

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
  v_actor uuid := auth.uid();
  v_sale public.cash_sales%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para anular ventas';
  end if;

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para anular ventas';
  end if;

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
  v_actor uuid := auth.uid();
  v_closure public.cash_closures%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para cerrar caja';
  end if;

  if not public.has_role(v_actor, 'user') then
    raise exception 'No tienes permisos para cerrar caja';
  end if;

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

revoke all on function public.issue_document(uuid) from public;
grant execute on function public.issue_document(uuid) to authenticated;

revoke all on function public.transition_document_status(uuid, public.document_status) from public;
grant execute on function public.transition_document_status(uuid, public.document_status) to authenticated;

revoke all on function public.get_or_create_cash_closure(date) from public;
grant execute on function public.get_or_create_cash_closure(date) to authenticated;

revoke all on function public.recalculate_cash_closure_totals(uuid) from public;
grant execute on function public.recalculate_cash_closure_totals(uuid) to authenticated;

revoke all on function public.attach_cash_sale_receipt(uuid, public.cash_receipt_kind, uuid, text) from public;
grant execute on function public.attach_cash_sale_receipt(uuid, public.cash_receipt_kind, uuid, text) to authenticated;

revoke all on function public.cancel_cash_sale(uuid, text) from public;
grant execute on function public.cancel_cash_sale(uuid, text) to authenticated;

revoke all on function public.close_cash_closure(uuid, numeric, numeric, numeric, text) from public;
grant execute on function public.close_cash_closure(uuid, numeric, numeric, numeric, text) to authenticated;
