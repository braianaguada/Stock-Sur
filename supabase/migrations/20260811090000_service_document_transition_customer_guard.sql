create or replace function public.guard_service_document_customer_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('SENT', 'APPROVED') and new.customer_id is null then
    raise exception 'Selecciona un cliente antes de enviar o aprobar el presupuesto de servicio';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_service_document_customer_transition on public.service_documents;
create trigger guard_service_document_customer_transition
before insert or update of status, customer_id on public.service_documents
for each row execute function public.guard_service_document_customer_transition();

comment on function public.guard_service_document_customer_transition() is
  'Impide enviar o aprobar documentos de servicio sin un cliente de la misma empresa validado por las FK/RLS existentes.';
