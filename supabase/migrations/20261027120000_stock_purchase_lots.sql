-- Purchase costs are immutable snapshots, independent of selling/base prices.
begin;
lock table public.stock_movements in access exclusive mode;

alter table public.stock_movements
  add column unit_cost_ars numeric,
  add column purchase_supplier text,
  add column cost_document_id uuid references public.documents(id),
  add column cost_is_cancellation boolean not null default false,
  add constraint stock_movement_purchase_cost_valid check (
    unit_cost_ars is null or (unit_cost_ars >= 0 and unit_cost_ars < 'Infinity'::numeric)
  );

create table public.stock_cost_lots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  item_id uuid not null references public.items(id),
  movement_id uuid references public.stock_movements(id),
  received_quantity numeric not null,
  unit_cost_ars numeric,
  supplier text,
  acquired_at timestamptz not null default clock_timestamp(),
  kind text not null check (kind in ('PURCHASE', 'UNVALUED', 'OPENING', 'SHORTAGE')),
  unique (company_id, item_id, id),
  check (unit_cost_ars is null or (unit_cost_ars >= 0 and unit_cost_ars < 'Infinity'::numeric))
);
create index stock_cost_lots_fifo_idx on public.stock_cost_lots(company_id, item_id, acquired_at, id);

create table public.stock_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  item_id uuid not null,
  lot_id uuid not null,
  movement_id uuid references public.stock_movements(id),
  quantity numeric not null check (quantity <> 0 and abs(quantity) < 'Infinity'::numeric),
  source_allocation_id uuid references public.stock_cost_allocations(id),
  foreign key (company_id, item_id, lot_id) references public.stock_cost_lots(company_id, item_id, id)
);
create index stock_cost_allocations_lot_idx on public.stock_cost_allocations(lot_id);
create index stock_cost_allocations_movement_idx on public.stock_cost_allocations(movement_id);
create index stock_cost_allocations_source_idx on public.stock_cost_allocations(source_allocation_id);

alter table public.stock_cost_lots enable row level security;
alter table public.stock_cost_allocations enable row level security;
create policy stock_cost_lots_read on public.stock_cost_lots for select to authenticated using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);
create policy stock_cost_allocations_read on public.stock_cost_allocations for select to authenticated using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
);
revoke all on public.stock_cost_lots, public.stock_cost_allocations from anon, authenticated;
grant select on public.stock_cost_lots, public.stock_cost_allocations to authenticated;

-- Existing balances have no reliable historical purchase cost. Do not invent one.
with balances as (
  select company_id, item_id, sum(public.stock_quantity_delta(type::text, quantity)) quantity,
         min(created_at) acquired_at
  from public.stock_movements group by company_id, item_id
), lots as (
  insert into public.stock_cost_lots(company_id, item_id, received_quantity, acquired_at, kind)
  select company_id, item_id, quantity, acquired_at, 'OPENING' from balances where quantity <> 0
  returning *
)
insert into public.stock_cost_allocations(company_id, item_id, lot_id, quantity)
select company_id, item_id, id, received_quantity from lots;

create function public.track_stock_purchase_lots()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_delta numeric := public.stock_quantity_delta(new.type::text, new.quantity);
  v_remaining numeric;
  v_take numeric;
  v_lot uuid;
  v_row record;
  v_positive record;
  v_negative record;
  v_doc public.documents%rowtype;
  v_origin uuid;
  v_tracked boolean := false;
begin
  -- Serializes every receipt, document and manual movement for the same item.
  perform 1 from public.items where id = new.item_id and company_id = new.company_id for update;
  if not found then raise exception 'El producto no pertenece a la empresa'; end if;
  if not exists (select 1 from public.companies where id = new.company_id and status = 'ACTIVE') then
    raise exception 'La empresa debe estar activa para registrar stock';
  end if;
  if v_delta = 0 or abs(v_delta) >= 'Infinity'::numeric then
    raise exception 'La cantidad de stock debe ser finita y distinta de cero';
  end if;
  if new.unit_cost_ars is not null and (v_delta < 0 or new.cost_document_id is not null) then
    raise exception 'El costo de compra solo corresponde a ingresos manuales';
  end if;

  if new.cost_document_id is not null then
    select * into v_doc from public.documents where id = new.cost_document_id and company_id = new.company_id;
    if not found then raise exception 'Documento de stock ajeno a la empresa'; end if;
    if new.cost_is_cancellation then
      if v_doc.doc_type = 'REMITO' and exists (
        select 1 from public.documents where origin_document_id = v_doc.id
        and company_id = new.company_id and doc_type = 'REMITO_DEVOLUCION' and status = 'EMITIDO'
      ) then raise exception 'Anula primero las devoluciones emitidas del remito'; end if;
      -- Reverse the exact original allocations, including shortage compensation.
      for v_row in
        select a.* from public.stock_cost_allocations a
        join public.stock_movements m on m.id = a.movement_id
        where m.cost_document_id = v_doc.id and not m.cost_is_cancellation
          and m.company_id = new.company_id and m.item_id = new.item_id
          and a.company_id = new.company_id and a.item_id = new.item_id
          and not exists (
            select 1 from public.stock_movements previous
            where previous.cost_document_id = v_doc.id and previous.cost_is_cancellation
              and previous.company_id = new.company_id and previous.item_id = new.item_id and previous.id <> new.id
          )
      loop
        insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity,source_allocation_id)
        values(new.company_id,new.item_id,v_row.lot_id,new.id,-v_row.quantity,v_row.source_allocation_id);
        v_tracked := true;
      end loop;
      -- Document lines may repeat an item: reverse only this movement's quantity.
      -- Emission/cancellation functions below aggregate by item to avoid duplicates.
    elsif v_doc.doc_type = 'REMITO_DEVOLUCION' then
      v_origin := v_doc.origin_document_id;
      v_remaining := v_delta;
      for v_row in
        select a.*, -a.quantity - coalesce((select sum(r.quantity)
          from public.stock_cost_allocations r where r.source_allocation_id = a.id),0) available
        from public.stock_cost_allocations a join public.stock_movements m on m.id = a.movement_id
        join public.stock_cost_lots l on l.id = a.lot_id
        where m.cost_document_id = v_origin and not m.cost_is_cancellation
          and m.company_id = new.company_id and m.item_id = new.item_id
          and a.quantity < 0 and a.company_id = new.company_id and a.item_id = new.item_id
        order by l.acquired_at,l.id,a.id
      loop
        v_tracked := true;
        v_take := least(v_remaining, greatest(v_row.available,0));
        if v_take > 0 then
          insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity,source_allocation_id)
          values(new.company_id,new.item_id,v_row.lot_id,new.id,v_take,v_row.id);
          v_remaining := v_remaining - v_take;
          v_tracked := true;
        end if;
        exit when v_remaining = 0;
      end loop;
      if v_tracked and v_remaining <> 0 then raise exception 'La devolucion supera las unidades consumidas pendientes de devolver'; end if;
    end if;
  end if;

  if not v_tracked then
    if v_delta > 0 then
      insert into public.stock_cost_lots(company_id,item_id,movement_id,received_quantity,unit_cost_ars,supplier,kind)
      values(new.company_id,new.item_id,new.id,v_delta,new.unit_cost_ars,nullif(btrim(new.purchase_supplier),''),
        case when new.unit_cost_ars is null then 'UNVALUED' else 'PURCHASE' end) returning id into v_lot;
      insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity)
      values(new.company_id,new.item_id,v_lot,new.id,v_delta);
    else
      v_remaining := -v_delta;
      for v_row in
        select l.id, sum(a.quantity) available from public.stock_cost_lots l
        join public.stock_cost_allocations a on a.lot_id = l.id
        where l.company_id = new.company_id and l.item_id = new.item_id
        group by l.id having sum(a.quantity) > 0 order by l.acquired_at,l.id
      loop
        v_take := least(v_remaining,v_row.available);
        insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity)
        values(new.company_id,new.item_id,v_row.id,new.id,-v_take);
        v_remaining := v_remaining - v_take;
        exit when v_remaining = 0;
      end loop;
      if v_remaining > 0 then
        insert into public.stock_cost_lots(company_id,item_id,movement_id,received_quantity,kind)
        values(new.company_id,new.item_id,new.id,0,'SHORTAGE') returning id into v_lot;
        insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity)
        values(new.company_id,new.item_id,v_lot,new.id,-v_remaining);
      end if;
    end if;
  end if;

  -- Cover previous negative stock before leaving newly received units available.
  -- Paired allocations do not change the total quantity of this movement.
  loop
    select l.id,sum(a.quantity) available into v_negative
    from public.stock_cost_lots l join public.stock_cost_allocations a on a.lot_id=l.id
    where l.company_id=new.company_id and l.item_id=new.item_id
    group by l.id having sum(a.quantity)<0 order by l.acquired_at,l.id limit 1;
    exit when not found;
    select l.id,sum(a.quantity) available into v_positive
    from public.stock_cost_lots l join public.stock_cost_allocations a on a.lot_id=l.id
    where l.company_id=new.company_id and l.item_id=new.item_id
    group by l.id having sum(a.quantity)>0 order by l.acquired_at,l.id limit 1;
    exit when not found;
    v_take := least(-v_negative.available,v_positive.available);
    insert into public.stock_cost_allocations(company_id,item_id,lot_id,movement_id,quantity) values
      (new.company_id,new.item_id,v_negative.id,new.id,v_take),
      (new.company_id,new.item_id,v_positive.id,new.id,-v_take);
  end loop;
  if (select coalesce(sum(quantity),0) from public.stock_cost_allocations where movement_id=new.id) <> v_delta then
    raise exception 'El movimiento no coincide con la asignacion de lotes';
  end if;
  return new;
end;
$$;
revoke all on function public.track_stock_purchase_lots() from public, anon, authenticated;
create trigger stock_purchase_lots after insert on public.stock_movements
for each row execute function public.track_stock_purchase_lots();

create function public.reject_stock_movement_changes()
returns trigger language plpgsql set search_path=public as $$
begin
  raise exception 'Los movimientos de stock son historicos. Registra un ajuste compensatorio';
end;
$$;
revoke all on function public.reject_stock_movement_changes() from public, anon, authenticated;
create trigger stock_movements_immutable before update or delete on public.stock_movements
for each row execute function public.reject_stock_movement_changes();

-- Document linkage is reserved to existing SECURITY DEFINER document operations.
revoke insert on public.stock_movements from authenticated;
grant insert(company_id,item_id,type,quantity,reference,notes,created_by,unit_cost_ars,purchase_supplier)
on public.stock_movements to authenticated;

create function public.list_stock_cost_lots(p_company_id uuid, p_item_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
  if not public.is_company_member(auth.uid(),p_company_id)
     or not public.has_company_permission(auth.uid(),p_company_id,'stock.view')
     or not exists(select 1 from public.companies where id=p_company_id and status='ACTIVE') then
    raise exception 'No tienes permisos para consultar los costos de esta empresa';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(q) order by q.acquired_at,q.id),'[]'::jsonb) from (
    select l.id,l.acquired_at,l.kind,l.supplier,l.unit_cost_ars,l.received_quantity,
      coalesce(sum(a.quantity),0) remaining_quantity,
      l.unit_cost_ars * coalesce(sum(a.quantity),0) remaining_value_ars
    from public.stock_cost_lots l left join public.stock_cost_allocations a on a.lot_id=l.id
    where l.company_id=p_company_id and l.item_id=p_item_id group by l.id
  ) q);
end;
$$;
revoke all on function public.list_stock_cost_lots(uuid,uuid) from public, anon;
grant execute on function public.list_stock_cost_lots(uuid,uuid) to authenticated;

-- Document functions follow below, preserving cash/accounting behavior.

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
      and origin.technician_id is not distinct from v_doc.technician_id
    for update;

    if not found then
      raise exception 'La devolucion debe referenciar un remito emitido con la misma asociacion tecnica';
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
    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by, cost_document_id, cost_is_cancellation)
    select
      v_doc.company_id,
      dl.item_id,
      'IN'::public.movement_type,
      dl.quantity,
      v_ref,
      'Ingreso por devolucion de remito',
      v_actor,
      v_doc.id,
      false
    from (select item_id, sum(quantity) quantity from public.document_lines
      where document_id = v_doc.id and item_id is not null group by item_id) dl;
  else
    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by, cost_document_id, cost_is_cancellation)
    select
      v_doc.company_id,
      dl.item_id,
      'OUT'::public.movement_type,
      dl.quantity,
      v_ref,
      'Salida automatica por emision de remito',
      v_actor,
      v_doc.id,
      false
    from (select item_id, sum(quantity) quantity from public.document_lines
      where document_id = v_doc.id and item_id is not null group by item_id) dl;
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

    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by, cost_document_id, cost_is_cancellation)
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
      v_actor,
      v_doc.id,
      true
    from (select item_id, sum(quantity) quantity from public.document_lines
      where document_id = v_doc.id and item_id is not null group by item_id) dl;

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

commit;
