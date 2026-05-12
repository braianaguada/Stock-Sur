create or replace function public.upsert_product_combo_with_lines(
  p_company_id uuid,
  p_combo_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_combo_id uuid;
  v_line jsonb;
  v_item_id uuid;
  v_quantity numeric;
  v_line_order integer;
  v_notes text;
  v_seen_items uuid[] := '{}'::uuid[];
  v_index integer := 0;
begin
  if v_actor is null then
    raise exception 'Debes autenticarte para guardar combos';
  end if;

  if not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No tenes permiso para guardar combos en esta empresa';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'El combo necesita un nombre';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'El combo necesita al menos un producto';
  end if;

  if p_combo_id is null then
    insert into public.product_combos (company_id, name, description, is_active, created_by)
    values (p_company_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_is_active, true), v_actor)
    returning id into v_combo_id;
  else
    select id into v_combo_id
    from public.product_combos
    where id = p_combo_id
      and company_id = p_company_id;

    if v_combo_id is null then
      raise exception 'El combo no existe o no pertenece a la empresa';
    end if;

    update public.product_combos
       set name = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           is_active = coalesce(p_is_active, true),
           updated_at = now()
     where id = v_combo_id;

    delete from public.product_combo_lines where combo_id = v_combo_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_index := v_index + 1;
    v_item_id := nullif(btrim(coalesce(v_line ->> 'item_id', '')), '')::uuid;
    v_quantity := nullif(btrim(coalesce(v_line ->> 'quantity', '')), '')::numeric;
    v_line_order := coalesce(nullif(btrim(coalesce(v_line ->> 'line_order', '')), '')::integer, 0);
    v_notes := nullif(btrim(coalesce(v_line ->> 'notes', '')), '');

    if v_item_id is null then
      raise exception 'Cada linea necesita un producto valido';
    end if;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada linea debe ser mayor a cero';
    end if;

    if v_item_id = any(v_seen_items) then
      raise exception 'No se puede repetir el mismo producto dentro del combo';
    end if;

    if not exists (
      select 1
      from public.items i
      where i.id = v_item_id
        and i.company_id = p_company_id
    ) then
      raise exception 'No se puede usar un producto inexistente o de otra empresa';
    end if;

    insert into public.product_combo_lines (combo_id, item_id, quantity, line_order, notes)
    values (v_combo_id, v_item_id, v_quantity, coalesce(nullif(v_line_order, 0), v_index), v_notes);

    v_seen_items := array_append(v_seen_items, v_item_id);
  end loop;

  return v_combo_id;
end;
$$;

revoke all on function public.upsert_product_combo_with_lines(uuid, uuid, text, text, boolean, jsonb) from public;
grant execute on function public.upsert_product_combo_with_lines(uuid, uuid, text, text, boolean, jsonb) to authenticated;
