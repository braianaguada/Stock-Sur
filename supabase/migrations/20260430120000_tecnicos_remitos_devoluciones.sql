alter type public.document_type add value if not exists 'REMITO_DEVOLUCION';

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  phone text null,
  notes text null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.technicians enable row level security;

create index if not exists technicians_company_name_idx
  on public.technicians(company_id, name);

alter table public.documents
  add column if not exists technician_id uuid null references public.technicians(id) on delete set null,
  add column if not exists origin_document_id uuid null references public.documents(id) on delete set null;

create index if not exists documents_technician_id_idx
  on public.documents(company_id, technician_id);

create index if not exists documents_origin_document_id_idx
  on public.documents(origin_document_id);

drop policy if exists "technicians_read_company_member" on public.technicians;
drop policy if exists "technicians_insert_company_member" on public.technicians;
drop policy if exists "technicians_update_company_member" on public.technicians;
drop policy if exists "technicians_delete_company_member" on public.technicians;

create policy "technicians_read_company_member"
on public.technicians
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "technicians_insert_company_member"
on public.technicians
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.create')
);

create policy "technicians_update_company_member"
on public.technicians
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "technicians_delete_company_member"
on public.technicians
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
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
  v_origin_line record;
  v_original_qty numeric;
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

  if v_doc.customer_kind = 'INTERNO' and v_doc.internal_remito_type is null then
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
    select * into v_doc
    from public.documents
    where id = p_document_id
    for update;

    if not exists (
      select 1
      from public.documents origin
      where origin.id = v_doc.origin_document_id
        and origin.doc_type = 'REMITO'
        and origin.technician_id = v_doc.technician_id
    ) then
      raise exception 'La devolucion debe referenciar un remito del mismo tecnico';
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

      if v_original_qty < v_line.quantity then
        raise exception 'La devolucion supera la cantidad retirada para %',
          coalesce(v_line.description, 'item');
      end if;
    end loop;
  else
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
    insert into public.stock_movements (item_id, type, quantity, reference, notes, created_by)
    select
      dl.item_id,
      'IN'::public.movement_type,
      dl.quantity,
      v_ref,
      'Ingreso por devolucion de remito',
      v_actor
    from public.document_lines dl
    where dl.document_id = v_doc.id and dl.item_id is not null;
  else
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
  end if;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    case when v_doc.doc_type = 'REMITO_DEVOLUCION' then 'REMITO_DEVOLUCION_EMITIDO' else 'REMITO_EMITIDO' end,
    jsonb_build_object('document_number', v_doc.document_number, 'reference', v_ref),
    v_actor
  );

  return v_doc;
end;
$$;
