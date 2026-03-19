alter table public.document_sequences
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.documents
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

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
    raise exception 'No existe una empresa para vincular documentos';
  end if;

  update public.document_sequences
  set company_id = v_company_id
  where company_id is null;

  update public.documents
  set company_id = v_company_id
  where company_id is null;
end
$$;

alter table public.document_sequences
  alter column company_id set not null;

alter table public.documents
  alter column company_id set not null;

drop index if exists documents_unique_number;
create unique index if not exists documents_unique_number
  on public.documents(company_id, doc_type, point_of_sale, document_number)
  where document_number is not null;

drop index if exists documents_search_idx;
create index if not exists documents_search_idx
  on public.documents(company_id, doc_type, status, issue_date desc, customer_name);

alter table public.document_sequences
  drop constraint if exists document_sequences_doc_type_point_of_sale_key;

create unique index if not exists document_sequences_company_doc_pos_key
  on public.document_sequences(company_id, doc_type, point_of_sale);

create index if not exists document_lines_doc_lookup_idx
  on public.document_lines(document_id, line_order);

create index if not exists document_events_doc_lookup_idx
  on public.document_events(document_id, created_at desc);

drop policy if exists "document_sequences_read_authenticated" on public.document_sequences;
drop policy if exists "document_sequences_write_admin" on public.document_sequences;
drop policy if exists "documents_read_authenticated" on public.documents;
drop policy if exists "documents_insert_owner_or_admin" on public.documents;
drop policy if exists "documents_update_owner_or_admin" on public.documents;
drop policy if exists "documents_delete_owner_or_admin" on public.documents;
drop policy if exists "document_lines_read_authenticated" on public.document_lines;
drop policy if exists "document_lines_insert_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_update_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_delete_owner_or_admin" on public.document_lines;
drop policy if exists "document_events_read_authenticated" on public.document_events;
drop policy if exists "document_events_insert_owner_or_admin" on public.document_events;

create policy "document_sequences_read_company_member"
on public.document_sequences
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "document_sequences_manage_company_documents"
on public.document_sequences
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.issue')
);

create policy "documents_read_company_member"
on public.documents
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "documents_insert_company_member"
on public.documents
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'documents.create')
  and created_by = auth.uid()
);

create policy "documents_update_company_member"
on public.documents
for update
to authenticated
using (
  status = 'BORRADOR'
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
)
with check (
  status = 'BORRADOR'
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
);

create policy "documents_delete_company_member"
on public.documents
for delete
to authenticated
using (
  status = 'BORRADOR'
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.edit')
);

create policy "document_lines_read_company_member"
on public.document_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.view')
  )
);

create policy "document_lines_insert_company_member"
on public.document_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and d.created_by = auth.uid()
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "document_lines_update_company_member"
on public.document_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and d.created_by = auth.uid()
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
)
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and d.created_by = auth.uid()
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "document_lines_delete_company_member"
on public.document_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and d.created_by = auth.uid()
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "document_events_read_company_member"
on public.document_events
for select
to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.view')
  )
);

create policy "document_events_insert_company_member"
on public.document_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and public.is_company_member(auth.uid(), d.company_id)
      and (
        public.has_company_permission(auth.uid(), d.company_id, 'documents.create')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.issue')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.approve')
        or public.has_company_permission(auth.uid(), d.company_id, 'documents.cancel')
      )
  )
);

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
