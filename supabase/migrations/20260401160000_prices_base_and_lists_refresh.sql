create table if not exists public.item_pricing_base (
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  base_cost numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  primary key (company_id, item_id)
);

create table if not exists public.price_list_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  event_type text not null,
  affected_items_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

alter table public.price_lists
  add column if not exists description text null,
  add column if not exists status text not null default 'PENDING',
  add column if not exists last_recalculated_at timestamptz null,
  add column if not exists last_recalculated_by uuid null references auth.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid null references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_lists_status_check'
  ) then
    alter table public.price_lists
      add constraint price_lists_status_check
      check (status in ('PENDING', 'UPDATED'));
  end if;
end
$$;

alter table public.price_list_items
  add column if not exists calculated_price numeric not null default 0,
  add column if not exists needs_recalculation boolean not null default true,
  add column if not exists last_calculated_at timestamptz null,
  add column if not exists last_calculated_by uuid null references auth.users(id);

create index if not exists item_pricing_base_company_item_idx
  on public.item_pricing_base(company_id, item_id);

create index if not exists price_list_history_price_list_created_idx
  on public.price_list_history(price_list_id, created_at desc);

create index if not exists price_list_items_company_pending_idx
  on public.price_list_items(company_id, price_list_id, needs_recalculation, is_active);

insert into public.item_pricing_base (company_id, item_id, base_cost)
select i.company_id, i.id, 0
from public.items i
on conflict (company_id, item_id) do nothing;

create or replace function public.compute_price_list_value(
  p_base_cost numeric,
  p_flete_pct numeric,
  p_utilidad_pct numeric,
  p_impuesto_pct numeric
)
returns numeric
language sql
immutable
as $$
  select round(
    greatest(coalesce(p_base_cost, 0), 0)
    * (1 + greatest(coalesce(p_flete_pct, 0), 0) / 100)
    * (1 + greatest(coalesce(p_utilidad_pct, 0), 0) / 100)
    * (1 + greatest(coalesce(p_impuesto_pct, 0), 0) / 100),
    2
  )
$$;

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

  if not v_is_active then
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
    needs_recalculation
  )
  select
    pl.company_id,
    pl.id,
    p_item_id,
    true,
    0,
    pl.flete_pct,
    pl.utilidad_pct,
    pl.impuesto_pct,
    0,
    true
  from public.price_lists pl
  where pl.company_id = p_company_id
  on conflict (price_list_id, item_id) do update
    set is_active = true;
end;
$$;

create or replace function public.mark_price_lists_pending_for_item_base_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists trg_mark_price_lists_pending_for_item_base_change on public.item_pricing_base;

create trigger trg_mark_price_lists_pending_for_item_base_change
after insert or update of base_cost on public.item_pricing_base
for each row
execute function public.mark_price_lists_pending_for_item_base_change();

create or replace function public.sync_item_pricing_base_with_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.item_pricing_base (company_id, item_id, base_cost)
  values (new.company_id, new.id, 0)
  on conflict (company_id, item_id) do nothing;

  if coalesce(new.is_active, false) then
    perform public.ensure_price_list_items_for_company_item(new.company_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_item_pricing_base_with_items on public.items;

create trigger trg_sync_item_pricing_base_with_items
after insert or update of is_active on public.items
for each row
execute function public.sync_item_pricing_base_with_items();

create or replace function public.mark_price_list_pending_on_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.price_list_items
    set needs_recalculation = true,
        is_active = true
  where price_list_id = new.id
    and company_id = new.company_id;

  new.status := 'PENDING';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mark_price_list_pending_on_config_change on public.price_lists;

create trigger trg_mark_price_list_pending_on_config_change
before update of flete_pct, utilidad_pct, impuesto_pct, description, name on public.price_lists
for each row
execute function public.mark_price_list_pending_on_config_change();

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
    needs_recalculation
  )
  select
    new.company_id,
    new.id,
    i.id,
    i.is_active,
    0,
    new.flete_pct,
    new.utilidad_pct,
    new.impuesto_pct,
    0,
    true
  from public.items i
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

  return new;
end;
$$;

drop trigger if exists trg_seed_price_list_items_on_create on public.price_lists;

create trigger trg_seed_price_list_items_on_create
after insert on public.price_lists
for each row
execute function public.seed_price_list_items_on_create();

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
    set is_active = excluded.is_active;

  update public.price_list_items pli
    set base_cost = ipb.base_cost,
        flete_pct = pl.flete_pct,
        utilidad_pct = pl.utilidad_pct,
        impuesto_pct = pl.impuesto_pct,
        calculated_price = public.compute_price_list_value(ipb.base_cost, pl.flete_pct, pl.utilidad_pct, pl.impuesto_pct),
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
    and (pli.needs_recalculation = true or pli.is_active = false);

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
  where id = p_price_list_id;

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
    jsonb_build_object('scope', 'affected_items_only')
  );

  return v_affected_count;
end;
$$;

alter table public.item_pricing_base enable row level security;
alter table public.price_list_history enable row level security;

drop policy if exists "item_pricing_base_read_company_member" on public.item_pricing_base;
drop policy if exists "item_pricing_base_write_company_member" on public.item_pricing_base;
drop policy if exists "price_list_history_read_company_member" on public.price_list_history;
drop policy if exists "price_list_history_write_company_member" on public.price_list_history;

create policy "item_pricing_base_read_company_member"
on public.item_pricing_base
for select
to authenticated
using (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "item_pricing_base_write_company_member"
on public.item_pricing_base
for all
to authenticated
using (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
);

create policy "price_list_history_read_company_member"
on public.price_list_history
for select
to authenticated
using (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "price_list_history_write_company_member"
on public.price_list_history
for all
to authenticated
using (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
)
with check (
  public.is_superadmin(auth.uid())
  or public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
);

notify pgrst, 'reload schema';
