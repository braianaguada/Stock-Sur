alter table public.price_list_items
  add column if not exists manual_price_enabled boolean not null default false,
  add column if not exists manual_price_note text null,
  add column if not exists manual_price_updated_at timestamptz null,
  add column if not exists manual_price_updated_by uuid null references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_list_items_final_price_override_non_negative'
  ) then
    alter table public.price_list_items
      add constraint price_list_items_final_price_override_non_negative
      check (final_price_override is null or final_price_override >= 0);
  end if;
end
$$;

update public.price_list_items
set
  manual_price_enabled = true,
  manual_price_updated_at = coalesce(manual_price_updated_at, now())
where final_price_override is not null
  and final_price_override >= 0
  and manual_price_enabled = false;

create index if not exists price_list_items_manual_price_enabled_idx
  on public.price_list_items(company_id, price_list_id, manual_price_enabled)
  where manual_price_enabled = true;

comment on column public.price_list_items.final_price_override is
  'Precio personalizado final para este producto dentro de esta lista. Solo aplica cuando manual_price_enabled = true; no se redondea automaticamente.';
comment on column public.price_list_items.manual_price_enabled is
  'Activa el uso de final_price_override como precio operativo final del producto en esta lista.';
comment on column public.price_list_items.manual_price_note is
  'Nota opcional asociada al precio personalizado producto/lista.';

notify pgrst, 'reload schema';
