alter table public.service_jobs
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null references auth.users(id) on delete set null;

create index if not exists service_jobs_company_archived_idx
  on public.service_jobs(company_id, archived_at);

create index if not exists service_jobs_company_status_archived_idx
  on public.service_jobs(company_id, status, archived_at);

create or replace function public.prevent_nonempty_service_job_delete()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_has_services boolean;
  v_has_linked_documents boolean;
begin
  select exists(
    select 1
    from public.service_job_services service
    where service.job_id = old.id
  ) into v_has_services;

  select exists(
    select 1
    from public.documents document
    where document.company_id = old.company_id
      and document.service_id in (
        select service.id
        from public.service_job_services service
        where service.job_id = old.id
      )
  ) into v_has_linked_documents;

  if v_has_linked_documents then
    raise exception 'Este trabajo tiene remitos/documentos vinculados y no puede eliminarse.';
  end if;

  if v_has_services then
    raise exception 'Este trabajo tiene servicios asociados. Para conservar trazabilidad, podes archivarlo en lugar de eliminarlo.';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_nonempty_service_job_delete on public.service_jobs;
create trigger prevent_nonempty_service_job_delete
before delete on public.service_jobs
for each row
execute function public.prevent_nonempty_service_job_delete();
