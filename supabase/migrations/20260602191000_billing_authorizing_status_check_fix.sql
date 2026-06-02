alter table public.billing_documents
  drop constraint if exists billing_documents_status_check,
  drop constraint if exists billing_documents_fiscal_status_check,
  add constraint billing_documents_fiscal_status_check check (
    fiscal_status in ('DRAFT', 'READY_TO_AUTHORIZE', 'AUTHORIZING', 'AUTHORIZED', 'REJECTED', 'CANCELLED_INTERNAL')
  );
