create table if not exists public.customer_fiscal_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  tax_id text not null,
  legal_name text not null,
  tax_condition text null,
  fiscal_address text null,
  validation_status text not null default 'PENDING',
  validation_source text null,
  validation_error text null,
  validation_snapshot jsonb null,
  validated_at timestamptz null,
  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_fiscal_profiles_tax_id_digits check (tax_id ~ '^[0-9]{11}$'),
  constraint customer_fiscal_profiles_validation_status_check check (
    validation_status in ('PENDING', 'VALIDATED', 'ERROR', 'MANUAL_REVIEW')
  ),
  constraint customer_fiscal_profiles_company_customer_unique unique (company_id, customer_id)
);

create index if not exists customer_fiscal_profiles_company_tax_id_idx
  on public.customer_fiscal_profiles(company_id, tax_id);

create or replace function public.set_customer_fiscal_profiles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_fiscal_profiles_set_updated_at on public.customer_fiscal_profiles;
create trigger customer_fiscal_profiles_set_updated_at
before update on public.customer_fiscal_profiles
for each row
execute function public.set_customer_fiscal_profiles_updated_at();

alter table public.customer_fiscal_profiles enable row level security;

drop policy if exists "customer_fiscal_profiles_select_company_member" on public.customer_fiscal_profiles;
drop policy if exists "customer_fiscal_profiles_insert_company_member" on public.customer_fiscal_profiles;
drop policy if exists "customer_fiscal_profiles_update_company_member" on public.customer_fiscal_profiles;
drop policy if exists "customer_fiscal_profiles_delete_admin" on public.customer_fiscal_profiles;

create policy "customer_fiscal_profiles_select_company_member"
on public.customer_fiscal_profiles
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and (
    public.has_company_permission(auth.uid(), company_id, 'customers.view')
    or public.has_company_permission(auth.uid(), company_id, 'billing.view')
    or public.has_company_permission(auth.uid(), company_id, 'billing.create')
  )
);

create policy "customer_fiscal_profiles_insert_company_member"
on public.customer_fiscal_profiles
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
  and created_by = auth.uid()
  and exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and c.company_id = customer_fiscal_profiles.company_id
  )
);

create policy "customer_fiscal_profiles_update_company_member"
on public.customer_fiscal_profiles
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
  and exists (
    select 1
    from public.customers c
    where c.id = customer_id
      and c.company_id = customer_fiscal_profiles.company_id
  )
);

create policy "customer_fiscal_profiles_delete_admin"
on public.customer_fiscal_profiles
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_role(auth.uid(), company_id, 'admin')
);
