create or replace function public.list_users_with_access()
returns table (
  user_id uuid,
  email text,
  full_name text,
  global_roles text[],
  companies jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'No autorizado para listar usuarios';
  end if;

  return query
  with global_roles_by_user as (
    select
      gur.user_id,
      array_remove(array_agg(distinct r.code order by r.code), null) as global_roles
    from public.global_user_roles gur
    join public.roles r on r.id = gur.role_id
    group by gur.user_id
  ),
  company_access as (
    select
      cu.user_id,
      jsonb_agg(
        jsonb_build_object(
          'companyUserId', cu.id,
          'companyId', c.id,
          'companyName', c.name,
          'companySlug', c.slug,
          'status', cu.status,
          'roles', coalesce(
            (
              select array_remove(array_agg(distinct r.code order by r.code), null)
              from public.company_user_roles cur
              join public.roles r on r.id = cur.role_id
              where cur.company_user_id = cu.id
            ),
            array[]::text[]
          )
        )
        order by c.name
      ) as companies
    from public.company_users cu
    join public.companies c on c.id = cu.company_id
    group by cu.user_id
  )
  select
    p.user_id,
    au.email::text,
    nullif(trim(p.full_name), '') as full_name,
    coalesce(gr.global_roles, array[]::text[]) as global_roles,
    coalesce(ca.companies, '[]'::jsonb) as companies
  from public.profiles p
  join auth.users au on au.id = p.user_id
  left join global_roles_by_user gr on gr.user_id = p.user_id
  left join company_access ca on ca.user_id = p.user_id
  order by coalesce(nullif(trim(p.full_name), ''), au.email);
end;
$$;

revoke all on function public.list_users_with_access() from public;
grant execute on function public.list_users_with_access() to authenticated;
