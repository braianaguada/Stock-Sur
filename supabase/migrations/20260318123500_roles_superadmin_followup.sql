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
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

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
select id, 'user'::public.app_role
from auth.users
on conflict (user_id, role) do nothing;

insert into public.user_roles (user_id, role)
select id, 'superadmin'::public.app_role
from auth.users
where lower(email) = 'braianaguada@gmail.com'
on conflict (user_id, role) do nothing;
