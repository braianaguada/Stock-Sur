create or replace function public.update_item_base_cost(
  p_company_id uuid,
  p_item_id uuid,
  p_base_cost numeric
)
returns public.item_pricing_base
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.item_pricing_base%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión para actualizar costos';
  end if;

  if p_base_cost is null or p_base_cost < 0 then
    raise exception using errcode = '22023', message = 'El costo base debe ser mayor o igual a cero';
  end if;

  if not public.has_company_permission(v_actor, p_company_id, 'price_lists.edit') then
    raise exception using errcode = '42501', message = 'No tenés permiso para editar precios en esta empresa';
  end if;

  if not exists (
    select 1
    from public.items i
    where i.id = p_item_id
      and i.company_id = p_company_id
      and i.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'El ítem no existe o no está activo en esta empresa';
  end if;

  insert into public.item_pricing_base (company_id, item_id, base_cost, updated_by)
  values (p_company_id, p_item_id, 0, v_actor)
  on conflict (company_id, item_id) do nothing;

  select *
  into v_current
  from public.item_pricing_base
  where company_id = p_company_id
    and item_id = p_item_id
  for update;

  if v_current.base_cost is distinct from p_base_cost then
    insert into public.item_pricing_base_history (
      company_id, item_id, previous_base_cost, new_base_cost, changed_by
    ) values (
      p_company_id, p_item_id, v_current.base_cost, p_base_cost, v_actor
    );

    update public.item_pricing_base
    set base_cost = p_base_cost,
        updated_at = now(),
        updated_by = v_actor
    where company_id = p_company_id
      and item_id = p_item_id
    returning * into v_current;
  end if;

  return v_current;
end;
$$;

revoke all on function public.update_item_base_cost(uuid, uuid, numeric) from public;
grant execute on function public.update_item_base_cost(uuid, uuid, numeric) to authenticated;

comment on function public.update_item_base_cost(uuid, uuid, numeric) is
  'Actualiza costo base e historial de forma atómica, validando empresa, ítem y permiso efectivo.';

notify pgrst, 'reload schema';
