create or replace function public.create_company(
  p_name text,
  p_slug text
)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_company public.companies;
  v_company_user_id uuid;
begin
  if not public.is_superadmin(v_actor) then
    raise exception 'Solo un superadmin puede crear empresas';
  end if;

  if v_name = '' then
    raise exception 'El nombre de la empresa es obligatorio';
  end if;

  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El identificador debe contener solo letras minusculas, numeros y guiones';
  end if;

  insert into public.companies (name, slug, created_by)
  values (v_name, v_slug, v_actor)
  returning * into v_company;

  insert into public.company_settings (company_id, app_name, legal_name)
  values (v_company.id, v_company.name, v_company.name);

  insert into public.company_users (company_id, user_id, status, created_by)
  values (v_company.id, v_actor, 'ACTIVE', v_actor)
  returning id into v_company_user_id;

  insert into public.company_user_roles (company_user_id, role_id)
  select v_company_user_id, r.id
  from public.roles r
  where r.code = 'admin'
    and r.scope = 'COMPANY'
  on conflict (company_user_id, role_id) do nothing;

  return v_company;
exception
  when unique_violation then
    raise exception 'Ya existe una empresa con ese identificador';
end;
$$;

-- Repair companies created with the previous RPC version. This only grants the
-- creating superadmin membership in their own newly-created company.
insert into public.company_users (company_id, user_id, status, created_by)
select c.id, c.created_by, 'ACTIVE', c.created_by
from public.companies c
where c.created_by is not null
  and public.is_superadmin(c.created_by)
on conflict (company_id, user_id) do update
set status = 'ACTIVE';

insert into public.company_user_roles (company_user_id, role_id)
select cu.id, r.id
from public.company_users cu
join public.companies c
  on c.id = cu.company_id
 and c.created_by = cu.user_id
join public.roles r
  on r.code = 'admin'
 and r.scope = 'COMPANY'
where public.is_superadmin(cu.user_id)
on conflict (company_user_id, role_id) do nothing;

revoke all on function public.create_company(text, text) from public;
grant execute on function public.create_company(text, text) to authenticated;

notify pgrst, 'reload schema';
