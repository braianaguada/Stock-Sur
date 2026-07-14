create or replace function public.update_supplier_purchase_order_draft(
  p_company_id uuid,
  p_order_id uuid,
  p_notes text,
  p_lines jsonb
)
returns public.supplier_purchase_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.supplier_purchase_orders;
  v_existing_count integer;
  v_totals jsonb;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.status = 'ACTIVE') then
    raise exception 'La empresa no esta activa' using errcode = '42501';
  end if;
  if not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para editar ordenes de compra' using errcode = '42501';
  end if;

  select * into v_order
  from public.supplier_purchase_orders o
  where o.id = p_order_id and o.company_id = p_company_id
  for update;
  if v_order.id is null then raise exception 'Orden de compra inexistente'; end if;
  if v_order.status <> 'DRAFT' then raise exception 'Solo se pueden editar ordenes en borrador'; end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Los renglones deben ser un array'; end if;
  if jsonb_array_length(p_lines) = 0 then raise exception 'La orden debe incluir al menos un producto'; end if;
  if jsonb_array_length(p_lines) > 5000 then raise exception 'La orden supera el maximo de 5000 productos'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) x(line_id uuid, quantity integer)
    where x.line_id is null or x.quantity is null or x.quantity <= 0
  ) then raise exception 'Cada renglon requiere identificador y cantidad entera positiva'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) x(line_id uuid, quantity integer)
    group by x.line_id having count(*) > 1
  ) then raise exception 'La orden contiene renglones repetidos'; end if;

  select count(*) into v_existing_count
  from public.supplier_purchase_order_lines l
  where l.company_id = p_company_id and l.purchase_order_id = p_order_id;
  if v_existing_count <> jsonb_array_length(p_lines) or exists (
    select 1
    from jsonb_to_recordset(p_lines) x(line_id uuid, quantity integer)
    where not exists (
      select 1 from public.supplier_purchase_order_lines l
      where l.id = x.line_id and l.company_id = p_company_id and l.purchase_order_id = p_order_id
    )
  ) then raise exception 'Los renglones no pertenecen completos a la orden y empresa indicadas'; end if;

  update public.supplier_purchase_order_lines l
  set quantity = x.quantity
  from jsonb_to_recordset(p_lines) x(line_id uuid, quantity integer)
  where l.id = x.line_id and l.company_id = p_company_id and l.purchase_order_id = p_order_id;

  select coalesce(jsonb_object_agg(t.currency, t.total order by t.currency), '{}'::jsonb)
  into v_totals
  from (
    select l.currency, sum(l.line_total) as total
    from public.supplier_purchase_order_lines l
    where l.company_id = p_company_id and l.purchase_order_id = p_order_id
    group by l.currency
  ) t;

  update public.supplier_purchase_orders
  set notes = nullif(trim(p_notes), ''), totals_by_currency = v_totals, updated_at = now()
  where id = p_order_id and company_id = p_company_id
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.transition_supplier_purchase_order(
  p_company_id uuid,
  p_order_id uuid,
  p_target_status text
)
returns public.supplier_purchase_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.supplier_purchase_orders;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.status = 'ACTIVE') then
    raise exception 'La empresa no esta activa' using errcode = '42501';
  end if;
  if not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para actualizar ordenes de compra' using errcode = '42501';
  end if;

  select * into v_order
  from public.supplier_purchase_orders o
  where o.id = p_order_id and o.company_id = p_company_id
  for update;
  if v_order.id is null then raise exception 'Orden de compra inexistente'; end if;
  if not (
    (v_order.status = 'DRAFT' and p_target_status in ('SENT', 'CANCELLED'))
    or (v_order.status = 'SENT' and p_target_status = 'CANCELLED')
  ) then raise exception 'Transicion de estado no permitida'; end if;

  update public.supplier_purchase_orders
  set status = p_target_status, updated_at = now()
  where id = p_order_id and company_id = p_company_id
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.delete_supplier_purchase_order_draft(
  p_company_id uuid,
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.supplier_purchase_orders;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '42501'; end if;
  if not exists (select 1 from public.companies c where c.id = p_company_id and c.status = 'ACTIVE') then
    raise exception 'La empresa no esta activa' using errcode = '42501';
  end if;
  if not public.has_company_permission(v_uid, p_company_id, 'suppliers.edit') then
    raise exception 'No autorizado para eliminar ordenes de compra' using errcode = '42501';
  end if;

  select * into v_order
  from public.supplier_purchase_orders o
  where o.id = p_order_id and o.company_id = p_company_id
  for update;
  if v_order.id is null then raise exception 'Orden de compra inexistente'; end if;
  if v_order.status <> 'DRAFT' then raise exception 'Solo se pueden eliminar ordenes en borrador'; end if;

  delete from public.supplier_purchase_orders
  where id = p_order_id and company_id = p_company_id;
end;
$$;

revoke all on function public.update_supplier_purchase_order_draft(uuid, uuid, text, jsonb) from public;
revoke all on function public.transition_supplier_purchase_order(uuid, uuid, text) from public;
revoke all on function public.delete_supplier_purchase_order_draft(uuid, uuid) from public;
grant execute on function public.update_supplier_purchase_order_draft(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.transition_supplier_purchase_order(uuid, uuid, text) to authenticated;
grant execute on function public.delete_supplier_purchase_order_draft(uuid, uuid) to authenticated;

comment on function public.update_supplier_purchase_order_draft(uuid, uuid, text, jsonb) is
  'Edita cantidades y notas solo mientras la orden de compra permanece en borrador.';
comment on function public.transition_supplier_purchase_order(uuid, uuid, text) is
  'Avanza una orden de compra a enviada o la cancela sin generar movimientos operativos.';
comment on function public.delete_supplier_purchase_order_draft(uuid, uuid) is
  'Elimina exclusivamente ordenes de compra en borrador y sus renglones por cascada.';
