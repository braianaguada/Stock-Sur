create or replace function public.save_user_company_access(
  p_user_id uuid,
  p_company_id uuid,
  p_status public.company_user_status,
  p_role_id uuid,
  p_permission_overrides jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_company_user_id uuid;
  v_override jsonb;
  v_permission_id uuid;
  v_effect public.permission_effect;
  v_seen_permission_ids uuid[] := '{}'::uuid[];
begin
  if v_actor_id is null or not public.is_superadmin(v_actor_id) then
    raise exception 'Solo un superadmin puede gestionar accesos por empresa';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = p_user_id
  ) then
    raise exception 'El usuario seleccionado no existe';
  end if;

  if not exists (
    select 1
    from public.companies
    where id = p_company_id
      and status = 'ACTIVE'
  ) then
    raise exception 'La empresa seleccionada no existe o esta inactiva';
  end if;

  if not exists (
    select 1
    from public.roles
    where id = p_role_id
      and scope = 'COMPANY'
      and code in ('admin', 'operador', 'consulta')
  ) then
    raise exception 'El rol seleccionado no es un rol de empresa permitido';
  end if;

  if p_permission_overrides is null
     or jsonb_typeof(p_permission_overrides) <> 'array' then
    raise exception 'Las excepciones de permisos deben ser una lista';
  end if;

  for v_override in
    select value
    from jsonb_array_elements(p_permission_overrides)
  loop
    if jsonb_typeof(v_override) <> 'object'
       or nullif(v_override ->> 'permission_id', '') is null
       or nullif(v_override ->> 'effect', '') is null then
      raise exception 'Cada excepcion requiere permission_id y effect';
    end if;

    begin
      v_permission_id := (v_override ->> 'permission_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Una excepcion contiene un permission_id invalido';
    end;

    if (v_override ->> 'effect') not in ('ALLOW', 'DENY') then
      raise exception 'El efecto de una excepcion debe ser ALLOW o DENY';
    end if;
    v_effect := (v_override ->> 'effect')::public.permission_effect;

    if v_permission_id = any(v_seen_permission_ids) then
      raise exception 'No se permiten excepciones duplicadas para un permiso';
    end if;
    v_seen_permission_ids := array_append(v_seen_permission_ids, v_permission_id);

    if not exists (
      select 1
      from public.permissions
      where id = v_permission_id
        and module <> 'users'
    ) then
      raise exception 'Una excepcion referencia un permiso inexistente o no administrable';
    end if;
  end loop;

  insert into public.company_users (
    company_id,
    user_id,
    status,
    created_by
  )
  values (
    p_company_id,
    p_user_id,
    p_status,
    v_actor_id
  )
  on conflict (company_id, user_id)
  do update
    set status = excluded.status,
        updated_at = now()
  returning id into v_company_user_id;

  perform 1
  from public.company_users
  where id = v_company_user_id
  for update;

  delete from public.company_user_roles
  where company_user_id = v_company_user_id;

  insert into public.company_user_roles (company_user_id, role_id)
  values (v_company_user_id, p_role_id);

  delete from public.company_user_permissions
  where company_user_id = v_company_user_id;

  insert into public.company_user_permissions (
    company_user_id,
    permission_id,
    effect
  )
  select
    v_company_user_id,
    (entry ->> 'permission_id')::uuid,
    (entry ->> 'effect')::public.permission_effect
  from jsonb_array_elements(p_permission_overrides) as entries(entry);

  return v_company_user_id;
end;
$$;

revoke all on function public.save_user_company_access(
  uuid,
  uuid,
  public.company_user_status,
  uuid,
  jsonb
) from public;

grant execute on function public.save_user_company_access(
  uuid,
  uuid,
  public.company_user_status,
  uuid,
  jsonb
) to authenticated;
