alter table public.documents
  add column if not exists service_id uuid null references public.service_job_services(id) on delete set null;

create index if not exists documents_company_service_idx
  on public.documents(company_id, service_id)
  where service_id is not null;

create or replace function public.validate_document_service_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_service_company_id uuid;
begin
  if new.service_id is null then
    return new;
  end if;

  if new.doc_type <> 'REMITO' then
    raise exception 'Solo los remitos pueden asociarse a servicios';
  end if;

  select service.company_id
    into v_service_company_id
  from public.service_job_services service
  where service.id = new.service_id;

  if v_service_company_id is null then
    raise exception 'Servicio no encontrado';
  end if;

  if v_service_company_id <> new.company_id then
    raise exception 'El servicio no pertenece a la empresa del documento';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_document_service_link on public.documents;
create trigger validate_document_service_link
before insert or update of service_id, doc_type, company_id on public.documents
for each row
execute function public.validate_document_service_link();
