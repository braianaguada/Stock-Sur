create table if not exists public.product_combos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.product_combo_lines (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.product_combos(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  quantity numeric not null,
  line_order integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  constraint product_combo_lines_quantity_positive check (quantity > 0),
  constraint product_combo_lines_unique_item_per_combo unique (combo_id, item_id)
);

alter table public.product_combos enable row level security;
alter table public.product_combo_lines enable row level security;

drop policy if exists "product_combos_select_company_member" on public.product_combos;
drop policy if exists "product_combos_insert_company_member" on public.product_combos;
drop policy if exists "product_combos_update_company_member" on public.product_combos;
drop policy if exists "product_combos_delete_company_member" on public.product_combos;

create policy "product_combos_select_company_member"
on public.product_combos
for select
to authenticated
using (public.is_company_member(auth.uid(), company_id));

create policy "product_combos_insert_company_member"
on public.product_combos
for insert
to authenticated
with check (public.is_company_member(auth.uid(), company_id));

create policy "product_combos_update_company_member"
on public.product_combos
for update
to authenticated
using (public.is_company_member(auth.uid(), company_id))
with check (public.is_company_member(auth.uid(), company_id));

create policy "product_combos_delete_company_member"
on public.product_combos
for delete
to authenticated
using (public.is_company_member(auth.uid(), company_id));

drop policy if exists "product_combo_lines_select_company_member" on public.product_combo_lines;
drop policy if exists "product_combo_lines_insert_company_member" on public.product_combo_lines;
drop policy if exists "product_combo_lines_update_company_member" on public.product_combo_lines;
drop policy if exists "product_combo_lines_delete_company_member" on public.product_combo_lines;

create policy "product_combo_lines_select_company_member"
on public.product_combo_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.product_combos c
    where c.id = combo_id
      and public.is_company_member(auth.uid(), c.company_id)
  )
);

create policy "product_combo_lines_insert_company_member"
on public.product_combo_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.product_combos c
    join public.items i on i.id = item_id
    where c.id = combo_id
      and public.is_company_member(auth.uid(), c.company_id)
      and i.company_id = c.company_id
  )
);

create policy "product_combo_lines_update_company_member"
on public.product_combo_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.product_combos c
    where c.id = combo_id
      and public.is_company_member(auth.uid(), c.company_id)
  )
)
with check (
  exists (
    select 1
    from public.product_combos c
    join public.items i on i.id = item_id
    where c.id = combo_id
      and public.is_company_member(auth.uid(), c.company_id)
      and i.company_id = c.company_id
  )
);

create policy "product_combo_lines_delete_company_member"
on public.product_combo_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.product_combos c
    where c.id = combo_id
      and public.is_company_member(auth.uid(), c.company_id)
  )
);
