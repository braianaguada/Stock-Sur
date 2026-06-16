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

create or replace function public.register_customer_account_debit_from_document(
  p_company_id uuid,
  p_customer_id uuid,
  p_document_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;
  if v_doc.customer_kind = 'INTERNO' or v_doc.customer_id is null then
    raise exception 'La cuenta corriente requiere un remito comercial con cliente identificado';
  end if;
  if v_doc.customer_id <> p_customer_id then
    raise exception 'El cliente del documento no coincide';
  end if;
  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se contemplan remitos en esta etapa';
  end if;
  if upper(btrim(coalesce(v_doc.payment_terms, ''))) <> 'CUENTA_CORRIENTE' then
    raise exception 'El remito no tiene condicion de cuenta corriente';
  end if;

  return public.record_customer_account_entry(
    p_company_id, p_customer_id, 'DEBIT', 'DOCUMENT', p_document_id,
    coalesce(p_amount, v_doc.total),
    coalesce(p_description, format('Debito por %s', v_doc.doc_type::text)),
    v_doc.issue_date, p_notes, p_metadata, p_document_id, null
  );
end;
$$;

create or replace function public.reject_internal_remito_billing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_remito_id is not null and exists (
    select 1
    from public.documents d
    where d.id = new.source_remito_id
      and d.customer_kind = 'INTERNO'
  ) then
    raise exception 'Los remitos internos no generan comprobantes fiscales';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_internal_remito_billing on public.billing_documents;
create trigger reject_internal_remito_billing
before insert or update of source_remito_id on public.billing_documents
for each row execute function public.reject_internal_remito_billing();

comment on function public.validate_document_recipient_rules() is
  'Valida estrictamente remitos internos y relaciones comerciales antes de cualquier efecto de emision.';
