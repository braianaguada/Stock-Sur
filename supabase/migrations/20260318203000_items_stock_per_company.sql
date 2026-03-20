alter table public.items
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.item_aliases
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.stock_movements
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
    raise exception 'No existe una empresa para vincular items y stock';
  end if;

  update public.items
  set company_id = v_company_id
  where company_id is null;

  update public.item_aliases ia
  set company_id = i.company_id
  from public.items i
  where ia.item_id = i.id
    and ia.company_id is null;

  update public.stock_movements sm
  set company_id = i.company_id
  from public.items i
  where sm.item_id = i.id
    and sm.company_id is null;
end
$$;

alter table public.items
  alter column company_id set not null;

alter table public.item_aliases
  alter column company_id set not null;

alter table public.stock_movements
  alter column company_id set not null;

alter table public.items
  drop constraint if exists items_sku_key;

create unique index if not exists items_company_sku_key
  on public.items(company_id, sku);

create index if not exists items_company_search_idx
  on public.items(company_id, is_active, category, created_at desc);

create index if not exists item_aliases_company_alias_idx
  on public.item_aliases(company_id, alias);

create index if not exists stock_movements_company_created_idx
  on public.stock_movements(company_id, created_at desc);

drop policy if exists "items_read_authenticated" on public.items;
drop policy if exists "items_insert_owner_or_admin" on public.items;
drop policy if exists "items_update_owner_or_admin" on public.items;
drop policy if exists "items_delete_owner_or_admin" on public.items;
drop policy if exists "item_aliases_read_authenticated" on public.item_aliases;
drop policy if exists "item_aliases_insert_owner_or_admin" on public.item_aliases;
drop policy if exists "item_aliases_update_owner_or_admin" on public.item_aliases;
drop policy if exists "item_aliases_delete_owner_or_admin" on public.item_aliases;
drop policy if exists "stock_movements_read_authenticated" on public.stock_movements;
drop policy if exists "stock_movements_insert_owner_or_admin" on public.stock_movements;
drop policy if exists "stock_movements_update_owner_or_admin" on public.stock_movements;
drop policy if exists "stock_movements_delete_owner_or_admin" on public.stock_movements;

create policy "items_read_company_member"
on public.items
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
);

create policy "items_insert_company_member"
on public.items
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "items_update_company_member"
on public.items
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "items_delete_company_member"
on public.items
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "item_aliases_read_company_member"
on public.item_aliases
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
);

create policy "item_aliases_insert_company_member"
on public.item_aliases
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.company_id = item_aliases.company_id
  )
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "item_aliases_update_company_member"
on public.item_aliases
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.company_id = item_aliases.company_id
  )
);

create policy "item_aliases_delete_company_member"
on public.item_aliases
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "stock_movements_read_company_member"
on public.stock_movements
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
);

create policy "stock_movements_insert_company_member"
on public.stock_movements
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and (created_by = auth.uid() or created_by is null)
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.company_id = stock_movements.company_id
  )
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

create policy "stock_movements_update_company_member"
on public.stock_movements
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
  and exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.company_id = stock_movements.company_id
  )
);

create policy "stock_movements_delete_company_member"
on public.stock_movements
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
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
    where sm.company_id = v_doc.company_id
      and sm.item_id = v_line.item_id;

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

    insert into public.stock_movements (company_id, item_id, type, quantity, reference, notes, created_by)
    select
      v_doc.company_id,
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
