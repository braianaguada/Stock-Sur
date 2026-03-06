alter type public.document_status rename to document_status_old;

create type public.document_status as enum (
  'BORRADOR',
  'ENVIADO',
  'APROBADO',
  'RECHAZADO',
  'EMITIDO',
  'ANULADO'
);

drop policy if exists "documents_update_owner_or_admin" on public.documents;
drop policy if exists "documents_delete_owner_or_admin" on public.documents;
drop policy if exists "document_lines_insert_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_update_owner_or_admin" on public.document_lines;
drop policy if exists "document_lines_delete_owner_or_admin" on public.document_lines;

alter table public.documents
  alter column status drop default;

alter table public.documents
  alter column status type public.document_status
  using (
    case
      when status::text in ('DRAFT', 'BORRADOR') then 'BORRADOR'
      when status::text = 'SENT' then 'ENVIADO'
      when status::text in ('ACCEPTED', 'APROBADO') then 'APROBADO'
      when status::text in ('REJECTED', 'RECHAZADO') then 'RECHAZADO'
      when status::text in ('ISSUED', 'EMITIDO') and doc_type = 'PRESUPUESTO' then 'APROBADO'
      when status::text in ('ISSUED', 'EMITIDO') then 'EMITIDO'
      when status::text in ('CANCELLED', 'ANULADO') then 'ANULADO'
      else 'BORRADOR'
    end
  )::public.document_status;

alter table public.documents
  alter column status set default 'BORRADOR'::public.document_status;

drop type public.document_status_old;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'document_customer_kind' and n.nspname = 'public'
  ) then
    create type public.document_customer_kind as enum ('GENERAL', 'INTERNO', 'EMPRESA');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'internal_remito_type' and n.nspname = 'public'
  ) then
    create type public.internal_remito_type as enum ('CUENTA_CORRIENTE', 'DESCUENTO_SUELDO');
  end if;
end
$$;

alter table public.documents
  add column if not exists customer_kind public.document_customer_kind not null default 'GENERAL',
  add column if not exists internal_remito_type public.internal_remito_type null,
  add column if not exists source_document_id uuid null references public.documents(id);

alter table public.documents
  drop constraint if exists documents_internal_remito_type_check;

alter table public.documents
  add constraint documents_internal_remito_type_check
  check (
    internal_remito_type is null
    or (doc_type = 'REMITO' and customer_kind = 'INTERNO')
  );

create index if not exists documents_source_document_idx
  on public.documents(source_document_id);

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
    auth.uid()
  from public.document_lines dl
  where dl.document_id = v_doc.id and dl.item_id is not null;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'REMITO_EMITIDO',
    jsonb_build_object('document_number', v_doc.document_number, 'reference', v_ref),
    auth.uid()
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
  v_doc public.documents%rowtype;
  v_updated public.documents%rowtype;
  v_ref text;
begin
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

  update public.documents
  set status = p_target_status,
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
      auth.uid()
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  end if;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'STATUS_CHANGED',
    jsonb_build_object('from', v_doc.status, 'to', p_target_status),
    auth.uid()
  );

  return v_updated;
end;
$$;

drop policy if exists "documents_update_owner_or_admin" on public.documents;
create policy "documents_update_owner_or_admin" on public.documents for update to authenticated
using (
  status = 'BORRADOR'
  and (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
)
with check (
  status = 'BORRADOR'
  and (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
);

drop policy if exists "documents_delete_owner_or_admin" on public.documents;
create policy "documents_delete_owner_or_admin" on public.documents for delete to authenticated
using (
  status = 'BORRADOR'
  and (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
);

drop policy if exists "document_lines_insert_owner_or_admin" on public.document_lines;
create policy "document_lines_insert_owner_or_admin" on public.document_lines for insert to authenticated
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and (d.created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  )
);

drop policy if exists "document_lines_update_owner_or_admin" on public.document_lines;
create policy "document_lines_update_owner_or_admin" on public.document_lines for update to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and (d.created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  )
)
with check (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and (d.created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  )
);

drop policy if exists "document_lines_delete_owner_or_admin" on public.document_lines;
create policy "document_lines_delete_owner_or_admin" on public.document_lines for delete to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.status = 'BORRADOR'
      and (d.created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  )
);
