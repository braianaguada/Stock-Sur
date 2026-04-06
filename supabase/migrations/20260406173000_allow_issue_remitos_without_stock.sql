alter table public.company_settings
  add column if not exists allow_issue_remitos_without_stock boolean not null default false;

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
  v_allow_without_stock boolean := false;
  v_stock_shortages jsonb := '[]'::jsonb;
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

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'REMITO_EMITIDO',
    jsonb_build_object(
      'document_number', v_doc.document_number,
      'reference', v_ref,
      'issued_without_stock', jsonb_array_length(v_stock_shortages) > 0,
      'stock_shortages', v_stock_shortages
    ),
    v_actor
  );

  return v_doc;
end;
$$;

notify pgrst, 'reload schema';
