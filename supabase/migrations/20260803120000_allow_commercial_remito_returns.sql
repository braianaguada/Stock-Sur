-- Permite devolver remitos comerciales sin tecnico, preservando exactamente
-- la asociacion tecnica (incluido NULL) del documento de origen.
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
