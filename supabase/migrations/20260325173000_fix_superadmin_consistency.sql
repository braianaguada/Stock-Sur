do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    join pg_enum e on e.enumtypid = t.oid
    where n.nspname = 'public'
      and t.typname = 'app_role'
      and e.enumlabel = 'superadmin'
  ) then
    alter type public.app_role add value 'superadmin';
  end if;
end
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and (
        role = _role
        or (role = 'superadmin' and _role <> 'superadmin')
      )
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  if lower(coalesce(new.email, '')) = 'braianaguada@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'superadmin')
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$$;

insert into public.user_roles (user_id, role)
select id, 'superadmin'::public.app_role
from auth.users
where lower(email) = 'braianaguada@gmail.com'
on conflict (user_id, role) do nothing;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'roles'
  ) then
    insert into public.roles (code, name, scope, description)
    values ('superadmin', 'Superadmin', 'GLOBAL', 'Acceso total a la plataforma y a todas las empresas')
    on conflict (code) do update
    set
      name = excluded.name,
      scope = excluded.scope,
      description = excluded.description;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'global_user_roles'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'roles'
  ) then
    insert into public.global_user_roles (user_id, role_id)
    select u.id, r.id
    from auth.users u
    join public.roles r on r.code = 'superadmin' and r.scope = 'GLOBAL'
    where lower(u.email) = 'braianaguada@gmail.com'
    on conflict (user_id, role_id) do nothing;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_superadmin'
  ) then
    perform public.is_superadmin(id)
    from auth.users
    where lower(email) = 'braianaguada@gmail.com'
    limit 1;
  end if;
end
$$;

notify pgrst, 'reload schema';
