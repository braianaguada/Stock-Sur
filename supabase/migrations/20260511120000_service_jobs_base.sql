create table if not exists public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'OPEN',
  priority text null default 'NORMAL',
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_jobs_title_not_blank check (length(trim(title)) > 0),
  constraint service_jobs_status_valid check (status in ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED')),
  constraint service_jobs_priority_valid check (priority is null or priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

create table if not exists public.service_job_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.service_jobs(id) on delete cascade,
  title text not null,
  description text null,
  scheduled_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  status text not null default 'PENDING',
  tasks_performed text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_job_services_title_not_blank check (length(trim(title)) > 0),
  constraint service_job_services_status_valid check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'))
);

create table if not exists public.service_job_service_technicians (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null references public.service_job_services(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint service_job_service_technicians_unique unique (service_id, technician_id)
);

create index if not exists service_jobs_company_status_opened_idx
  on public.service_jobs(company_id, status, opened_at desc);

create index if not exists service_jobs_company_customer_idx
  on public.service_jobs(company_id, customer_id);

create index if not exists service_job_services_company_job_idx
  on public.service_job_services(company_id, job_id, scheduled_at desc);

create index if not exists service_job_service_technicians_service_idx
  on public.service_job_service_technicians(company_id, service_id);

create index if not exists service_job_service_technicians_technician_idx
  on public.service_job_service_technicians(company_id, technician_id);

create or replace function public.validate_service_job_customer_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer record;
begin
  new.title := trim(new.title);
  if new.priority = '' then
    new.priority := null;
  end if;

  if new.customer_id is null then
    return new;
  end if;

  select company_id, is_occasional
  into v_customer
  from public.customers
  where id = new.customer_id;

  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  if v_customer.company_id <> new.company_id then
    raise exception 'El cliente no pertenece a la empresa del trabajo';
  end if;

  if v_customer.is_occasional then
    raise exception 'No se pueden asociar trabajos a clientes ocasionales';
  end if;

  return new;
end;
$$;

create or replace function public.validate_service_job_service_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_job_company_id uuid;
begin
  new.title := trim(new.title);

  select company_id
  into v_job_company_id
  from public.service_jobs
  where id = new.job_id;

  if not found then
    raise exception 'Trabajo no encontrado';
  end if;

  if v_job_company_id <> new.company_id then
    raise exception 'El servicio no pertenece a la empresa del trabajo';
  end if;

  return new;
end;
$$;

create or replace function public.validate_service_job_service_technician_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_service_company_id uuid;
  v_technician_company_id uuid;
begin
  select company_id
  into v_service_company_id
  from public.service_job_services
  where id = new.service_id;

  if not found then
    raise exception 'Servicio no encontrado';
  end if;

  select company_id
  into v_technician_company_id
  from public.technicians
  where id = new.technician_id;

  if not found then
    raise exception 'Tecnico no encontrado';
  end if;

  if v_service_company_id <> new.company_id or v_technician_company_id <> new.company_id then
    raise exception 'El servicio y el tecnico deben pertenecer a la misma empresa';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_service_job_customer_company on public.service_jobs;
create trigger validate_service_job_customer_company
before insert or update on public.service_jobs
for each row execute function public.validate_service_job_customer_company();

drop trigger if exists update_service_jobs_updated_at on public.service_jobs;
create trigger update_service_jobs_updated_at
before update on public.service_jobs
for each row execute function public.update_updated_at_column();

drop trigger if exists validate_service_job_service_company on public.service_job_services;
create trigger validate_service_job_service_company
before insert or update on public.service_job_services
for each row execute function public.validate_service_job_service_company();

drop trigger if exists update_service_job_services_updated_at on public.service_job_services;
create trigger update_service_job_services_updated_at
before update on public.service_job_services
for each row execute function public.update_updated_at_column();

drop trigger if exists validate_service_job_service_technician_company on public.service_job_service_technicians;
create trigger validate_service_job_service_technician_company
before insert or update on public.service_job_service_technicians
for each row execute function public.validate_service_job_service_technician_company();

alter table public.service_jobs enable row level security;
alter table public.service_job_services enable row level security;
alter table public.service_job_service_technicians enable row level security;

create policy "service_jobs_read_company_member"
on public.service_jobs
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "service_jobs_insert_company_member"
on public.service_jobs
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.create')
);

create policy "service_jobs_update_company_member"
on public.service_jobs
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

create policy "service_jobs_delete_company_member"
on public.service_jobs
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "service_job_services_read_company_member"
on public.service_job_services
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "service_job_services_insert_company_member"
on public.service_job_services
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.create')
);

create policy "service_job_services_update_company_member"
on public.service_job_services
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

create policy "service_job_services_delete_company_member"
on public.service_job_services
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "service_job_service_technicians_read_company_member"
on public.service_job_service_technicians
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "service_job_service_technicians_insert_company_member"
on public.service_job_service_technicians
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'customers.create')
);

create policy "service_job_service_technicians_update_company_member"
on public.service_job_service_technicians
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

create policy "service_job_service_technicians_delete_company_member"
on public.service_job_service_technicians
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);
