alter table public.price_lists
  add column if not exists flete_pct numeric not null default 10,
  add column if not exists utilidad_pct numeric not null default 55,
  add column if not exists impuesto_pct numeric not null default 21,
  add column if not exists round_mode text not null default 'none',
  add column if not exists round_to numeric not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_lists_round_mode_check'
  ) then
    alter table public.price_lists
      add constraint price_lists_round_mode_check
      check (round_mode in ('none', 'integer', 'tens', 'hundreds', 'x99'));
  end if;
end
$$;

alter table public.price_list_items
  add column if not exists base_cost numeric not null default 0,
  add column if not exists flete_pct numeric null,
  add column if not exists utilidad_pct numeric null,
  add column if not exists impuesto_pct numeric null,
  add column if not exists final_price_override numeric null;

create or replace function public.sync_price_list_items_with_items_active()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = false and coalesce(old.is_active, true) <> false then
    update public.price_list_items
      set is_active = false
      where item_id = new.id
        and is_active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_price_list_items_with_items_active on public.items;

create trigger trg_sync_price_list_items_with_items_active
after update of is_active on public.items
for each row
execute function public.sync_price_list_items_with_items_active();
