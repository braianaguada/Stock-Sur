create table public.technician_daily_statuses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  technician_id uuid not null references public.technicians(id) on delete restrict,
  business_date date not null,
  status text not null default 'AVAILABLE',
  service_id uuid null references public.service_job_services(id) on delete set null,
  activity text null,
  location text null,
  notes text null,
  position integer not null default 0,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_daily_statuses_unique_day unique (company_id, technician_id, business_date),
  constraint technician_daily_statuses_status_valid check (
    status in ('AVAILABLE', 'ASSIGNED', 'TRAVELLING', 'WORKING', 'PAUSED', 'DONE', 'ABSENT')
  ),
  constraint technician_daily_statuses_position_valid check (position >= 0)
);

create index technician_daily_statuses_company_date_status_idx
  on public.technician_daily_statuses(company_id, business_date, status, position, updated_at);

create or replace function public.validate_technician_daily_status_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_technician_company_id uuid;
  v_service_company_id uuid;
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;

  select company_id into v_technician_company_id
  from public.technicians
  where id = new.technician_id;

  if not found then
    raise exception 'Tecnico no encontrado';
  end if;

  if v_technician_company_id <> new.company_id then
    raise exception 'El tecnico no pertenece a la empresa activa';
  end if;

  if new.service_id is not null then
    select company_id into v_service_company_id
    from public.service_job_services
    where id = new.service_id;

    if not found then
      raise exception 'Servicio no encontrado';
    end if;

    if v_service_company_id <> new.company_id then
      raise exception 'El servicio no pertenece a la empresa activa';
    end if;
  end if;

  new.activity := nullif(btrim(new.activity), '');
  new.location := nullif(btrim(new.location), '');
  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$$;

create trigger validate_technician_daily_status_company
before insert or update on public.technician_daily_statuses
for each row execute function public.validate_technician_daily_status_company();

create trigger update_technician_daily_statuses_updated_at
before update on public.technician_daily_statuses
for each row execute function public.update_updated_at_column();

alter table public.technician_daily_statuses enable row level security;

create policy "technician_daily_statuses_read_company_member"
on public.technician_daily_statuses
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
  and public.has_company_permission(auth.uid(), company_id, 'customers.view')
);

create policy "technician_daily_statuses_insert_company_member"
on public.technician_daily_statuses
for insert
to authenticated
with check (
  public.is_company_member(auth.uid(), company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "technician_daily_statuses_update_company_member"
on public.technician_daily_statuses
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);

create policy "technician_daily_statuses_delete_company_member"
on public.technician_daily_statuses
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and exists (select 1 from public.companies c where c.id = company_id and c.status = 'ACTIVE')
  and public.has_company_permission(auth.uid(), company_id, 'customers.edit')
);
