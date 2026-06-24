create or replace function public.has_company_permission(_user_id uuid, _company_id uuid, _permission_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_user_id uuid;
  v_is_denied boolean;
  v_is_allowed boolean;
begin
  if (
    public.is_superadmin(_user_id)
    or public.has_role(_user_id, 'admin')
  ) and public.is_company_operable(_company_id) then
    return true;
  end if;

  select cu.id
  into v_company_user_id
  from public.company_users cu
  join public.companies c on c.id = cu.company_id
  where cu.user_id = _user_id
    and cu.company_id = _company_id
    and cu.status = 'ACTIVE'
    and c.status = 'ACTIVE'
  limit 1;

  if v_company_user_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.company_user_permissions cup
    join public.permissions p on p.id = cup.permission_id
    where cup.company_user_id = v_company_user_id
      and p.code = _permission_code
      and cup.effect = 'DENY'
  )
  into v_is_denied;

  if v_is_denied then
    return false;
  end if;

  select exists (
    select 1
    from public.company_user_permissions cup
    join public.permissions p on p.id = cup.permission_id
    where cup.company_user_id = v_company_user_id
      and p.code = _permission_code
      and cup.effect = 'ALLOW'
  )
  into v_is_allowed;

  if v_is_allowed then
    return true;
  end if;

  return exists (
    select 1
    from public.company_user_roles cur
    join public.roles r on r.id = cur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where cur.company_user_id = v_company_user_id
      and r.scope = 'COMPANY'
      and p.code = _permission_code
  );
end;
$$;
