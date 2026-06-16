create or replace function public.validate_document_service_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_service_company_id uuid;
  v_service_customer_id uuid;
  v_customer_is_occasional boolean;
begin
  if new.service_id is null then
    return new;
  end if;

  if new.doc_type <> 'REMITO' then
    raise exception 'Solo los remitos pueden asociarse a servicios';
  end if;
  if new.customer_kind = 'INTERNO' then
    raise exception 'Un remito interno no puede asociarse a servicios';
  end if;
  if new.customer_id is null then
    raise exception 'El remito asociado a un servicio requiere cliente registrado';
  end if;

  select service.company_id, job.customer_id
    into v_service_company_id, v_service_customer_id
  from public.service_job_services service
  join public.service_jobs job on job.id = service.job_id
  where service.id = new.service_id;

  if not found then
    raise exception 'Servicio no encontrado';
  end if;
  if v_service_company_id <> new.company_id then
    raise exception 'El servicio no pertenece a la empresa del documento';
  end if;
  if v_service_customer_id is null then
    raise exception 'El servicio asociado no tiene cliente registrado';
  end if;
  if v_service_customer_id <> new.customer_id then
    raise exception 'El cliente del remito debe coincidir con el cliente del servicio';
  end if;

  select customer.is_occasional
    into v_customer_is_occasional
  from public.customers customer
  where customer.id = new.customer_id
    and customer.company_id = new.company_id;

  if not found then
    raise exception 'Cliente del remito no encontrado para la empresa';
  end if;
  if coalesce(v_customer_is_occasional, false) then
    raise exception 'Un remito de cliente ocasional no puede asociarse a servicios';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_document_service_link on public.documents;
create trigger validate_document_service_link
before insert or update of service_id, doc_type, company_id, customer_id, customer_kind
on public.documents
for each row
execute function public.validate_document_service_link();

create or replace function public.validate_document_recipient_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_service_customer_id uuid;
  v_customer_is_occasional boolean;
begin
  if new.customer_kind = 'INTERNO' then
    if new.doc_type <> 'REMITO' then
      raise exception 'El destinatario interno solo aplica a remitos';
    end if;
    if new.technician_id is null then
      raise exception 'El remito interno requiere tecnico';
    end if;
    if new.internal_remito_type is null then
      raise exception 'El remito interno requiere tipo interno';
    end if;
    if new.customer_id is not null then
      raise exception 'El remito interno no puede tener cliente comercial';
    end if;
    if new.customer_name is not null or new.customer_tax_id is not null or new.customer_tax_condition is not null then
      raise exception 'El remito interno no puede tener datos comerciales o fiscales';
    end if;
    if new.payment_terms is not null then
      raise exception 'El remito interno no puede tener condicion de venta';
    end if;
    if new.service_id is not null then
      raise exception 'El remito interno no puede tener servicio asociado';
    end if;
  elsif new.customer_kind = 'EMPRESA' and new.customer_id is null then
    raise exception 'Empresa requiere un cliente registrado';
  end if;

  if new.customer_id is null then
    new.customer_tax_id := null;
    new.customer_tax_condition := null;
  end if;

  if new.service_id is not null then
    if new.doc_type <> 'REMITO' then
      raise exception 'Solo los remitos pueden asociarse a servicios';
    end if;
    if new.customer_kind = 'INTERNO' then
      raise exception 'Un remito interno no puede asociarse a servicios';
    end if;
    if new.customer_id is null then
      raise exception 'El remito asociado a un servicio requiere cliente registrado';
    end if;

    select job.customer_id
      into v_service_customer_id
    from public.service_job_services service
    join public.service_jobs job on job.id = service.job_id
    where service.id = new.service_id
      and service.company_id = new.company_id;

    if not found then
      raise exception 'Servicio no encontrado para la empresa del documento';
    end if;
    if v_service_customer_id is null then
      raise exception 'El servicio asociado no tiene cliente registrado';
    end if;
    if v_service_customer_id <> new.customer_id then
      raise exception 'El cliente del remito debe coincidir con el cliente del servicio';
    end if;

    select customer.is_occasional
      into v_customer_is_occasional
    from public.customers customer
    where customer.id = new.customer_id
      and customer.company_id = new.company_id;

    if not found then
      raise exception 'Cliente del remito no encontrado para la empresa';
    end if;
    if coalesce(v_customer_is_occasional, false) then
      raise exception 'Un remito de cliente ocasional no puede asociarse a servicios';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_document_recipient_rules on public.documents;
create trigger validate_document_recipient_rules
before insert or update of doc_type, customer_id, customer_name, customer_tax_id,
  customer_tax_condition, customer_kind, internal_remito_type, technician_id,
  payment_terms, service_id, status, company_id
on public.documents
for each row
execute function public.validate_document_recipient_rules();

comment on function public.validate_document_service_link() is
  'Valida que los remitos asociados a servicios sean comerciales, de la misma empresa y del mismo cliente registrado.';

comment on function public.validate_document_recipient_rules() is
  'Valida remitos internos y relaciones documento-servicio antes de cualquier mutacion relevante.';
