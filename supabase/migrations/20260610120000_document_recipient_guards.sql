create or replace function public.validate_document_recipient_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_service_customer_id uuid;
begin
  if new.customer_kind = 'INTERNO' then
    if new.doc_type <> 'REMITO' then
      raise exception 'El destinatario interno solo aplica a remitos';
    end if;

    if new.technician_id is null then
      raise exception 'El remito interno requiere tecnico';
    end if;

    if new.internal_remito_type is null then
      raise exception 'El remito interno requiere tipo de imputacion';
    end if;

    new.customer_id := null;
    new.customer_name := null;
    new.customer_tax_id := null;
    new.customer_tax_condition := null;
    new.payment_terms := null;
    new.service_id := null;
  elsif new.customer_kind = 'EMPRESA' and new.customer_id is null then
    raise exception 'Empresa requiere un cliente registrado';
  end if;

  if new.customer_id is null then
    new.customer_tax_id := null;
    new.customer_tax_condition := null;
  end if;

  if new.service_id is not null then
    select job.customer_id
      into v_service_customer_id
    from public.service_job_services service
    join public.service_jobs job on job.id = service.job_id
    where service.id = new.service_id
      and service.company_id = new.company_id;

    if not found then
      raise exception 'Servicio no encontrado para la empresa del documento';
    end if;

    if v_service_customer_id is distinct from new.customer_id then
      raise exception 'El cliente del remito debe coincidir con el cliente del servicio';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_document_recipient_rules on public.documents;
create trigger validate_document_recipient_rules
before insert or update of doc_type, customer_id, customer_name, customer_tax_id,
  customer_tax_condition, customer_kind, internal_remito_type, technician_id,
  payment_terms, service_id, status
on public.documents
for each row
execute function public.validate_document_recipient_rules();

comment on function public.validate_document_recipient_rules() is
  'Normaliza destinatarios internos y valida identidad comercial/servicios sin modificar historicos hasta su proxima mutacion.';
