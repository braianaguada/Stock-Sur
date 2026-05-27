alter table public.documents
  drop constraint if exists documents_internal_remito_type_check;

alter table public.documents
  add constraint documents_internal_remito_type_check
  check (
    internal_remito_type is null
    or (doc_type in ('REMITO', 'REMITO_DEVOLUCION') and customer_kind = 'INTERNO')
  );
