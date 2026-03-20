drop policy if exists "company_users_select_self_company_or_superadmin" on public.company_users;
drop policy if exists "company_user_roles_select_company_or_superadmin" on public.company_user_roles;
drop policy if exists "company_user_permissions_select_company_or_superadmin" on public.company_user_permissions;

create policy "company_users_select_self_or_superadmin"
on public.company_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_superadmin(auth.uid())
);

create policy "company_user_roles_select_self_or_superadmin"
on public.company_user_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.id = company_user_id
      and (
        cu.user_id = auth.uid()
        or public.is_superadmin(auth.uid())
      )
  )
);

create policy "company_user_permissions_select_self_or_superadmin"
on public.company_user_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.company_users cu
    where cu.id = company_user_id
      and (
        cu.user_id = auth.uid()
        or public.is_superadmin(auth.uid())
      )
  )
);
