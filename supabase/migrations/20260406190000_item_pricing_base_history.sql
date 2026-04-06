create table if not exists public.item_pricing_base_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  previous_base_cost numeric not null default 0,
  new_base_cost numeric not null default 0,
  changed_at timestamptz not null default now(),
  changed_by uuid null references auth.users(id)
);

create index if not exists item_pricing_base_history_company_item_idx
  on public.item_pricing_base_history(company_id, item_id, changed_at desc);

alter table public.item_pricing_base_history enable row level security;

drop policy if exists "item_pricing_base_history_read_company_member" on public.item_pricing_base_history;
drop policy if exists "item_pricing_base_history_insert_company_member" on public.item_pricing_base_history;

create policy "item_pricing_base_history_read_company_member"
on public.item_pricing_base_history
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.view')
);

create policy "item_pricing_base_history_insert_company_member"
on public.item_pricing_base_history
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.manage')
);

notify pgrst, 'reload schema';
