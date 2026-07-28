-- Avoid marking unrelated products as pending when price-list metadata changes
-- or when a base cost is written without an effective value change.

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
    set needs_recalculation = true
  where pli.company_id = new.company_id
    and pli.item_id = new.item_id
    and pli.is_active = true;

  update public.price_lists pl
    set status = 'PENDING',
        updated_at = now(),
        updated_by = new.updated_by
  where pl.company_id = new.company_id
    and exists (
      select 1
      from public.price_list_items pli
      where pli.company_id = new.company_id
        and pli.price_list_id = pl.id
        and pli.item_id = new.item_id
        and pli.is_active = true
    );

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

  update public.price_list_items
    set needs_recalculation = true
  where price_list_id = new.id
    and company_id = new.company_id
    and is_active = true;

  new.status := 'PENDING';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mark_price_list_pending_on_config_change on public.price_lists;

create trigger trg_mark_price_list_pending_on_config_change
before update of flete_pct, utilidad_pct, impuesto_pct on public.price_lists
for each row
when (
  old.flete_pct is distinct from new.flete_pct
  or old.utilidad_pct is distinct from new.utilidad_pct
  or old.impuesto_pct is distinct from new.impuesto_pct
)
execute function public.mark_price_list_pending_on_config_change();

create or replace function public.recalculate_price_list(
  p_price_list_id uuid,
  p_actor uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_affected_count integer := 0;
begin
  select company_id
  into v_company_id
  from public.price_lists
  where id = p_price_list_id;

  if v_company_id is null then
    raise exception 'Lista inexistente';
  end if;

  insert into public.price_list_items as existing (
    company_id,
    price_list_id,
    item_id,
    is_active,
    base_cost,
    flete_pct,
    utilidad_pct,
    impuesto_pct,
    calculated_price,
    needs_recalculation
  )
  select
    pl.company_id,
    pl.id,
    i.id,
    i.is_active,
    0,
    pl.flete_pct,
    pl.utilidad_pct,
    pl.impuesto_pct,
    0,
    true
  from public.price_lists pl
  join public.items i
    on i.company_id = pl.company_id
   and i.is_active = true
  where pl.id = p_price_list_id
  on conflict (price_list_id, item_id) do update
    set is_active = excluded.is_active,
        needs_recalculation = (
          existing.needs_recalculation
          or existing.is_active is distinct from excluded.is_active
        );

  update public.price_list_items pli
    set base_cost = ipb.base_cost,
        flete_pct = pl.flete_pct,
        utilidad_pct = pl.utilidad_pct,
        impuesto_pct = pl.impuesto_pct,
        calculated_price = public.compute_price_list_value(
          ipb.base_cost,
          pl.flete_pct,
          pl.utilidad_pct,
          pl.impuesto_pct
        ),
        needs_recalculation = false,
        last_calculated_at = now(),
        last_calculated_by = p_actor,
        is_active = true
  from public.price_lists pl
  join public.item_pricing_base ipb
    on ipb.company_id = pl.company_id
  where pli.price_list_id = pl.id
    and pli.company_id = pl.company_id
    and pli.item_id = ipb.item_id
    and pl.id = p_price_list_id
    and pli.needs_recalculation = true
    and pli.is_active = true;

  get diagnostics v_affected_count = row_count;

  update public.price_list_items pli
    set is_active = false
  where pli.price_list_id = p_price_list_id
    and pli.company_id = v_company_id
    and not exists (
      select 1
      from public.items i
      where i.company_id = pli.company_id
        and i.id = pli.item_id
        and i.is_active = true
    );

  update public.price_lists
    set status = 'UPDATED',
        last_recalculated_at = now(),
        last_recalculated_by = p_actor,
        updated_at = now(),
        updated_by = p_actor
  where id = p_price_list_id
    and company_id = v_company_id;

  insert into public.price_list_history (
    company_id,
    price_list_id,
    event_type,
    affected_items_count,
    created_by,
    details
  )
  values (
    v_company_id,
    p_price_list_id,
    'RECALCULATED',
    v_affected_count,
    p_actor,
    jsonb_build_object('scope', 'affected_active_items_only')
  );

  return v_affected_count;
end;
$$;
