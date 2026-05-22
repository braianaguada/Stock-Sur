alter table public.technicians
  add column if not exists is_active boolean not null default true;

create index if not exists technicians_company_active_name_idx
  on public.technicians(company_id, is_active, name);

create or replace function public.prevent_delete_technician_with_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.documents d
    where d.technician_id = old.id
    limit 1
  ) or exists (
    select 1
    from public.service_job_service_technicians sjst
    where sjst.technician_id = old.id
    limit 1
  ) then
    raise exception 'No se puede eliminar este tecnico porque tiene remitos, servicios o trabajos vinculados. Podes marcarlo como Inactivo para conservar el historial.'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_delete_technician_with_history on public.technicians;

create trigger trg_prevent_delete_technician_with_history
before delete on public.technicians
for each row
execute function public.prevent_delete_technician_with_history();
