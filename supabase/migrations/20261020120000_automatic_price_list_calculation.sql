-- Calculate prices atomically on the existing product, cost and list write paths.
-- Manual overrides remain untouched; every join is scoped to the owning company.
begin;

create or replace function public.ensure_price_list_items_for_company_item(
  p_company_id uuid,
  p_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_active boolean;
begin
  select coalesce(i.is_active, false)
  into v_is_active
  from public.items i
  where i.company_id = p_company_id
    and i.id = p_item_id;

  if v_is_active is not true then
    return;
  end if;

  insert into public.price_list_items (
    company_id,
    price_list_id,
    item_id,
    is_active,
    base_cost,
    flete_pct,
    utilidad_pct,
    impuesto_pct,
    calculated_price,
    needs_recalculation,
    last_calculated_at,
    last_calculated_by
  )
  select
    pl.company_id,
    pl.id,
    p_item_id,
    true,
    coalesce(ipb.base_cost, 0),
    pl.flete_pct,
    pl.utilidad_pct,
    pl.impuesto_pct,
    public.compute_price_list_value(coalesce(ipb.base_cost, 0), pl.flete_pct, pl.utilidad_pct, pl.impuesto_pct),
    false,
    now(),
    auth.uid()
  from public.price_lists pl
  left join public.item_pricing_base ipb on ipb.company_id = pl.company_id and ipb.item_id = p_item_id
  where pl.company_id = p_company_id
  on conflict (price_list_id, item_id) do update
    set is_active = true,
        base_cost = excluded.base_cost,
        flete_pct = excluded.flete_pct,
        utilidad_pct = excluded.utilidad_pct,
        impuesto_pct = excluded.impuesto_pct,
        calculated_price = excluded.calculated_price,
        needs_recalculation = false,
        last_calculated_at = now(),
        last_calculated_by = auth.uid()
  where price_list_items.company_id = excluded.company_id;

  update public.price_lists
  set status = 'UPDATED', last_recalculated_at = now(), last_recalculated_by = auth.uid()
  where company_id = p_company_id;
end;
$$;

create or replace function public.seed_price_list_items_on_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.price_list_items (
    company_id,
    price_list_id,
    item_id,
    is_active,
    base_cost,
    flete_pct,
    utilidad_pct,
    impuesto_pct,
    calculated_price,
    needs_recalculation,
    last_calculated_at,
    last_calculated_by
  )
  select
    new.company_id,
    new.id,
    i.id,
    i.is_active,
    coalesce(ipb.base_cost, 0),
    new.flete_pct,
    new.utilidad_pct,
    new.impuesto_pct,
    public.compute_price_list_value(coalesce(ipb.base_cost, 0), new.flete_pct, new.utilidad_pct, new.impuesto_pct),
    false,
    now(),
    new.created_by
  from public.items i
  left join public.item_pricing_base ipb on ipb.company_id = i.company_id and ipb.item_id = i.id
  where i.company_id = new.company_id
    and i.is_active = true
  on conflict (price_list_id, item_id) do nothing;

  insert into public.price_list_history (
    company_id,
    price_list_id,
    event_type,
    affected_items_count,
    created_by,
    details
  )
  values (
    new.company_id,
    new.id,
    'LIST_CREATED',
    (
      select count(*)
      from public.items i
      where i.company_id = new.company_id
        and i.is_active = true
    ),
    new.created_by,
    jsonb_build_object('name', new.name)
  );

  update public.price_lists
  set status = 'UPDATED', last_recalculated_at = now(), last_recalculated_by = new.created_by
  where id = new.id and company_id = new.company_id;

  return new;
end;
$$;

create or replace function public.mark_price_lists_pending_for_item_base_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.base_cost is not distinct from old.base_cost then
    return new;
  end if;

  perform public.ensure_price_list_items_for_company_item(new.company_id, new.item_id);

  update public.price_list_items pli
  set base_cost = new.base_cost,
      calculated_price = public.compute_price_list_value(new.base_cost, pl.flete_pct, pl.utilidad_pct, pl.impuesto_pct),
      flete_pct = pl.flete_pct,
      utilidad_pct = pl.utilidad_pct,
      impuesto_pct = pl.impuesto_pct,
      needs_recalculation = false,
      last_calculated_at = now(),
      last_calculated_by = new.updated_by
  from public.price_lists pl
  where pli.company_id = new.company_id and pli.item_id = new.item_id
    and pli.is_active = true
    and pl.id = pli.price_list_id and pl.company_id = pli.company_id;

  update public.price_lists pl
  set status = 'UPDATED', last_recalculated_at = now(), last_recalculated_by = new.updated_by,
      updated_at = now(), updated_by = new.updated_by
  where pl.company_id = new.company_id
    and exists (select 1 from public.price_list_items pli
      where pli.company_id = pl.company_id and pli.price_list_id = pl.id
        and pli.item_id = new.item_id and pli.is_active = true);
  return new;
end;
$$;

create or replace function public.mark_price_list_pending_on_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.flete_pct is not distinct from old.flete_pct
    and new.utilidad_pct is not distinct from old.utilidad_pct
    and new.impuesto_pct is not distinct from old.impuesto_pct then
    return new;
  end if;

  update public.price_list_items pli
  set base_cost = ipb.base_cost,
      flete_pct = new.flete_pct,
      utilidad_pct = new.utilidad_pct,
      impuesto_pct = new.impuesto_pct,
      calculated_price = public.compute_price_list_value(ipb.base_cost, new.flete_pct, new.utilidad_pct, new.impuesto_pct),
      needs_recalculation = false,
      last_calculated_at = now(),
      last_calculated_by = new.updated_by
  from public.item_pricing_base ipb
  where pli.price_list_id = new.id and pli.company_id = new.company_id
    and pli.is_active = true
    and ipb.company_id = pli.company_id and ipb.item_id = pli.item_id;

  new.status := 'UPDATED';
  new.last_recalculated_at := now();
  new.last_recalculated_by := new.updated_by;
  new.updated_at := now();
  return new;
end;
$$;

-- Resolve existing pending snapshots before removing the manual action.
update public.price_list_items pli
set base_cost = ipb.base_cost,
    flete_pct = pl.flete_pct, utilidad_pct = pl.utilidad_pct, impuesto_pct = pl.impuesto_pct,
    calculated_price = public.compute_price_list_value(ipb.base_cost, pl.flete_pct, pl.utilidad_pct, pl.impuesto_pct),
    needs_recalculation = false, last_calculated_at = now()
from public.price_lists pl, public.item_pricing_base ipb
where pli.price_list_id = pl.id and pli.company_id = pl.company_id
  and ipb.company_id = pli.company_id and ipb.item_id = pli.item_id
  and pli.is_active = true and pli.needs_recalculation = true;

update public.price_lists pl
set status = 'UPDATED', last_recalculated_at = now()
where pl.status = 'PENDING'
  and not exists (select 1 from public.price_list_items pli
    where pli.company_id = pl.company_id and pli.price_list_id = pl.id
      and pli.is_active = true and pli.needs_recalculation = true);

-- Internal helper: executable only through the existing authorized trigger paths.
revoke all on function public.ensure_price_list_items_for_company_item(uuid, uuid) from public, anon, authenticated;
revoke all on function public.seed_price_list_items_on_create() from public, anon, authenticated;
revoke all on function public.mark_price_lists_pending_for_item_base_change() from public, anon, authenticated;
revoke all on function public.mark_price_list_pending_on_config_change() from public, anon, authenticated;

commit;
