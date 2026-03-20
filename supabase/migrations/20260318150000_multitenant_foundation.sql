do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'company_status' and n.nspname = 'public'
  ) then
    create type public.company_status as enum ('ACTIVE', 'INACTIVE');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'company_user_status' and n.nspname = 'public'
  ) then
    create type public.company_user_status as enum ('ACTIVE', 'INACTIVE');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'role_scope' and n.nspname = 'public'
  ) then
    create type public.role_scope as enum ('GLOBAL', 'COMPANY');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'permission_effect' and n.nspname = 'public'
  ) then
    create type public.permission_effect as enum ('ALLOW', 'DENY');
  end if;
end
$$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.company_status not null default 'ACTIVE',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.company_user_status not null default 'ACTIVE',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  scope public.role_scope not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  action text not null,
  description text null,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.global_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.company_user_roles (
  company_user_id uuid not null references public.company_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_user_id, role_id)
);

create table if not exists public.company_user_permissions (
  id uuid primary key default gen_random_uuid(),
  company_user_id uuid not null references public.company_users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect public.permission_effect not null,
  created_at timestamptz not null default now(),
  unique (company_user_id, permission_id)
);

create index if not exists company_users_user_idx on public.company_users(user_id, company_id);
create index if not exists company_user_roles_role_idx on public.company_user_roles(role_id, company_user_id);
create index if not exists global_user_roles_role_idx on public.global_user_roles(role_id, user_id);
create index if not exists company_user_permissions_permission_idx on public.company_user_permissions(permission_id, company_user_id);

create trigger update_companies_updated_at
before update on public.companies
for each row execute function public.update_updated_at_column();

create trigger update_company_users_updated_at
before update on public.company_users
for each row execute function public.update_updated_at_column();

create or replace function public.is_superadmin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.global_user_roles gur
    join public.roles r on r.id = gur.role_id
    where gur.user_id = _user_id
      and r.code = 'superadmin'
      and r.scope = 'GLOBAL'
  );
$$;

create or replace function public.is_company_member(_user_id uuid, _company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin(_user_id)
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = _user_id
        and cu.company_id = _company_id
        and cu.status = 'ACTIVE'
    );
$$;

create or replace function public.has_company_role(_user_id uuid, _company_id uuid, _role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin(_user_id)
    or exists (
      select 1
      from public.company_users cu
      join public.company_user_roles cur on cur.company_user_id = cu.id
      join public.roles r on r.id = cur.role_id
      where cu.user_id = _user_id
        and cu.company_id = _company_id
        and cu.status = 'ACTIVE'
        and r.scope = 'COMPANY'
        and r.code = _role_code
    );
$$;

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
  if public.is_superadmin(_user_id) then
    return true;
  end if;

  select cu.id
  into v_company_user_id
  from public.company_users cu
  where cu.user_id = _user_id
    and cu.company_id = _company_id
    and cu.status = 'ACTIVE'
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

create or replace function public.get_user_company_ids(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cu.company_id
  from public.company_users cu
  where cu.user_id = _user_id
    and cu.status = 'ACTIVE'
  union
  select c.id
  from public.companies c
  where public.is_superadmin(_user_id);
$$;

alter table public.companies enable row level security;
alter table public.company_users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.global_user_roles enable row level security;
alter table public.company_user_roles enable row level security;
alter table public.company_user_permissions enable row level security;

create policy "companies_select_member_or_superadmin"
on public.companies
for select
to authenticated
using (public.is_company_member(auth.uid(), id));

create policy "companies_manage_superadmin"
on public.companies
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "company_users_select_self_company_or_superadmin"
on public.company_users
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_company_member(auth.uid(), company_id)
  or public.is_superadmin(auth.uid())
);

create policy "company_users_manage_superadmin"
on public.company_users
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "roles_read_authenticated"
on public.roles
for select
to authenticated
using (true);

create policy "roles_manage_superadmin"
on public.roles
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "permissions_read_authenticated"
on public.permissions
for select
to authenticated
using (true);

create policy "permissions_manage_superadmin"
on public.permissions
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "role_permissions_read_authenticated"
on public.role_permissions
for select
to authenticated
using (true);

create policy "role_permissions_manage_superadmin"
on public.role_permissions
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "global_user_roles_select_self_or_superadmin"
on public.global_user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "global_user_roles_manage_superadmin"
on public.global_user_roles
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "company_user_roles_select_company_or_superadmin"
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
        or public.is_company_member(auth.uid(), cu.company_id)
        or public.is_superadmin(auth.uid())
      )
  )
);

create policy "company_user_roles_manage_superadmin"
on public.company_user_roles
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

create policy "company_user_permissions_select_company_or_superadmin"
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
        or public.is_company_member(auth.uid(), cu.company_id)
        or public.is_superadmin(auth.uid())
      )
  )
);

create policy "company_user_permissions_manage_superadmin"
on public.company_user_permissions
for all
to authenticated
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

insert into public.roles (code, name, scope, description)
values
  ('superadmin', 'Superadmin', 'GLOBAL', 'Acceso total a la plataforma y a todas las empresas'),
  ('admin', 'Admin', 'COMPANY', 'Gestion operativa completa dentro de una empresa'),
  ('operador', 'Operador', 'COMPANY', 'Operacion diaria de caja y documentos'),
  ('consulta', 'Consulta', 'COMPANY', 'Acceso de solo lectura')
on conflict (code) do update
set
  name = excluded.name,
  scope = excluded.scope,
  description = excluded.description;

insert into public.permissions (code, module, action, description)
values
  ('cash.view', 'cash', 'view', 'Ver caja'),
  ('cash.create', 'cash', 'create', 'Registrar ventas y movimientos de caja'),
  ('cash.edit', 'cash', 'edit', 'Editar movimientos de caja'),
  ('cash.close', 'cash', 'close', 'Cerrar caja diaria'),
  ('cash.cancel', 'cash', 'cancel', 'Anular ventas o movimientos de caja'),
  ('documents.view', 'documents', 'view', 'Ver documentos'),
  ('documents.create', 'documents', 'create', 'Crear borradores de documentos'),
  ('documents.edit', 'documents', 'edit', 'Editar borradores de documentos'),
  ('documents.issue', 'documents', 'issue', 'Emitir remitos'),
  ('documents.approve', 'documents', 'approve', 'Aprobar o rechazar presupuestos'),
  ('documents.cancel', 'documents', 'cancel', 'Anular documentos'),
  ('documents.print', 'documents', 'print', 'Imprimir documentos'),
  ('stock.view', 'stock', 'view', 'Ver stock'),
  ('stock.edit', 'stock', 'edit', 'Editar stock y movimientos'),
  ('customers.view', 'customers', 'view', 'Ver clientes'),
  ('customers.create', 'customers', 'create', 'Crear clientes'),
  ('customers.edit', 'customers', 'edit', 'Editar clientes'),
  ('suppliers.view', 'suppliers', 'view', 'Ver proveedores'),
  ('suppliers.edit', 'suppliers', 'edit', 'Editar proveedores'),
  ('price_lists.view', 'price_lists', 'view', 'Ver listas de precio'),
  ('price_lists.edit', 'price_lists', 'edit', 'Editar listas de precio'),
  ('imports.view', 'imports', 'view', 'Ver importaciones'),
  ('imports.create', 'imports', 'create', 'Crear importaciones'),
  ('settings.view', 'settings', 'view', 'Ver configuracion'),
  ('settings.manage', 'settings', 'manage', 'Administrar configuracion'),
  ('users.view', 'users', 'view', 'Ver usuarios y permisos'),
  ('users.manage', 'users', 'manage', 'Administrar usuarios, roles y permisos')
on conflict (code) do update
set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

with role_map as (
  select r.id as role_id, r.code
  from public.roles r
  where r.scope = 'COMPANY'
),
permission_map as (
  select p.id as permission_id, p.code
  from public.permissions p
),
role_permission_seed as (
  select 'admin'::text as role_code, unnest(array[
    'cash.view','cash.create','cash.edit','cash.close','cash.cancel',
    'documents.view','documents.create','documents.edit','documents.issue','documents.approve','documents.cancel','documents.print',
    'stock.view','stock.edit',
    'customers.view','customers.create','customers.edit',
    'suppliers.view','suppliers.edit',
    'price_lists.view','price_lists.edit',
    'imports.view','imports.create',
    'settings.view','settings.manage',
    'users.view'
  ]) as permission_code
  union all
  select 'operador', unnest(array[
    'cash.view','cash.create','cash.close','cash.cancel',
    'documents.view','documents.create','documents.edit','documents.issue','documents.approve','documents.cancel','documents.print',
    'stock.view',
    'customers.view','customers.create','customers.edit',
    'suppliers.view',
    'price_lists.view',
    'imports.view',
    'settings.view'
  ])
  union all
  select 'consulta', unnest(array[
    'cash.view',
    'documents.view','documents.print',
    'stock.view',
    'customers.view',
    'suppliers.view',
    'price_lists.view',
    'imports.view',
    'settings.view'
  ])
)
insert into public.role_permissions (role_id, permission_id)
select rm.role_id, pm.permission_id
from role_permission_seed s
join role_map rm on rm.code = s.role_code
join permission_map pm on pm.code = s.permission_code
on conflict (role_id, permission_id) do nothing;

do $$
declare
  v_company_name text;
  v_company_slug text;
  v_company_id uuid;
begin
  select coalesce(
    nullif(btrim(legal_name), ''),
    nullif(btrim(app_name), '')
  )
  into v_company_name
  from public.company_settings
  limit 1;

  v_company_name := coalesce(v_company_name, 'Empresa inicial');
  v_company_slug := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_company_slug := trim(both '-' from v_company_slug);
  v_company_slug := coalesce(nullif(v_company_slug, ''), 'empresa-inicial');

  insert into public.companies (name, slug)
  values (v_company_name, v_company_slug)
  on conflict (slug) do update
  set name = excluded.name
  returning id into v_company_id;

  insert into public.company_users (company_id, user_id)
  select v_company_id, u.id
  from auth.users u
  on conflict (company_id, user_id) do nothing;

  insert into public.global_user_roles (user_id, role_id)
  select ur.user_id, r.id
  from public.user_roles ur
  join public.roles r on r.code = 'superadmin' and r.scope = 'GLOBAL'
  where ur.role = 'superadmin'
  on conflict (user_id, role_id) do nothing;

  insert into public.company_user_roles (company_user_id, role_id)
  select cu.id, r.id
  from public.company_users cu
  join public.roles r on r.code = 'admin' and r.scope = 'COMPANY'
  join public.user_roles ur on ur.user_id = cu.user_id and ur.role = 'admin'
  where cu.company_id = v_company_id
  on conflict (company_user_id, role_id) do nothing;

  insert into public.company_user_roles (company_user_id, role_id)
  select cu.id, r.id
  from public.company_users cu
  join public.roles r on r.code = 'operador' and r.scope = 'COMPANY'
  where cu.company_id = v_company_id
    and not exists (
      select 1
      from public.company_user_roles cur
      where cur.company_user_id = cu.id
    )
  on conflict (company_user_id, role_id) do nothing;
end
$$;
