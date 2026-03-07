create or replace function public.issue_document(p_document_id uuid)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_next integer;
  v_line record;
  v_available numeric;
  v_ref text;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.status <> 'DRAFT' then
    raise exception 'Solo se pueden emitir borradores';
  end if;

  if not exists (select 1 from public.document_lines where document_id = v_doc.id) then
    raise exception 'No se puede emitir un documento sin lineas';
  end if;

  if v_doc.doc_type = 'REMITO' then
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
  end if;

  insert into public.document_sequences (doc_type, point_of_sale, last_number)
  values (v_doc.doc_type, v_doc.point_of_sale, 0)
  on conflict (doc_type, point_of_sale) do nothing;

  update public.document_sequences
  set last_number = last_number + 1, updated_at = now()
  where doc_type = v_doc.doc_type and point_of_sale = v_doc.point_of_sale
  returning last_number into v_next;

  update public.documents
  set status = 'ISSUED',
      document_number = v_next,
      issue_date = coalesce(issue_date, now()::date),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  v_ref := format('%s %s', v_doc.doc_type::text, format('%s-%s', lpad(v_doc.point_of_sale::text, 4, '0'), lpad(v_doc.document_number::text, 8, '0')));

  if v_doc.doc_type = 'REMITO' then
    insert into public.stock_movements (item_id, type, quantity, reference, notes, created_by)
    select
      dl.item_id,
      'OUT'::public.movement_type,
      dl.quantity,
      v_ref,
      'Salida automatica por emision de remito',
      auth.uid()
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'ISSUED',
    jsonb_build_object('document_number', v_doc.document_number, 'reference', v_ref),
    auth.uid()
  );

  return v_doc;
end;
$$;

-- Documents: lock updates/deletes to DRAFT only
DROP POLICY IF EXISTS "documents_update_owner_or_admin" ON public.documents;
CREATE POLICY "documents_update_owner_or_admin" ON public.documents FOR UPDATE TO authenticated
USING (
  status = 'DRAFT'
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  status = 'DRAFT'
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "documents_delete_owner_or_admin" ON public.documents;
CREATE POLICY "documents_delete_owner_or_admin" ON public.documents FOR DELETE TO authenticated
USING (
  status = 'DRAFT'
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);

-- Lines: only editable while parent document is DRAFT
DROP POLICY IF EXISTS "document_lines_insert_owner_or_admin" ON public.document_lines;
CREATE POLICY "document_lines_insert_owner_or_admin" ON public.document_lines FOR INSERT TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "document_lines_update_owner_or_admin" ON public.document_lines;
CREATE POLICY "document_lines_update_owner_or_admin" ON public.document_lines FOR UPDATE TO authenticated
USING (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "document_lines_delete_owner_or_admin" ON public.document_lines;
CREATE POLICY "document_lines_delete_owner_or_admin" ON public.document_lines FOR DELETE TO authenticated
USING (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'DRAFT'
      and (d.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
