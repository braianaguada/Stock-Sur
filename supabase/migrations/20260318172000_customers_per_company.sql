alter table public.customers
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

do $$
declare
  v_company_id uuid;
begin
  select id
  into v_company_id
  from public.companies
  order by created_at
  limit 1;

  if v_company_id is null then
    raise exception 'No existe una empresa para vincular clientes';
  end if;

  update public.customers
  set company_id = v_company_id
  where company_id is null;
end
$$;

alter table public.customers
  alter column company_id set not null;

create index if not exists customers_company_idx
  on public.customers(company_id, name);

drop policy if exists "customers_read_authenticated" on public.customers;
drop policy if exists "customers_insert_owner_or_admin" on public.customers;
drop policy if exists "customers_update_owner_or_admin" on public.customers;
drop policy if exists "customers_delete_owner_or_admin" on public.customers;

create policy "customers_read_company_member"
on public.customers
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "customers_insert_company_member"
on public.customers
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.create')
  and created_by = auth.uid()
);

create policy "customers_update_company_member"
on public.customers
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "customers_delete_company_member"
on public.customers
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);
