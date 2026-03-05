do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'item_demand_profile'
      and n.nspname = 'public'
  ) then
    create type public.item_demand_profile as enum ('LOW', 'MEDIUM', 'HIGH');
  end if;
end
$$;

alter table public.items
  add column if not exists demand_profile public.item_demand_profile not null default 'LOW';
