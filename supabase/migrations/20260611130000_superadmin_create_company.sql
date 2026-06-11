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
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_company public.companies;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'Solo un superadmin puede crear empresas';
  end if;

  if v_name = '' then
    raise exception 'El nombre de la empresa es obligatorio';
  end if;

  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El identificador debe contener solo letras minusculas, numeros y guiones';
  end if;

  insert into public.companies (name, slug, created_by)
  values (v_name, v_slug, auth.uid())
  returning * into v_company;

  insert into public.company_settings (company_id, app_name, legal_name)
  values (v_company.id, v_company.name, v_company.name);

  return v_company;
exception
  when unique_violation then
    raise exception 'Ya existe una empresa con ese identificador';
end;
$$;

revoke all on function public.create_company(text, text) from public;
grant execute on function public.create_company(text, text) to authenticated;

notify pgrst, 'reload schema';
