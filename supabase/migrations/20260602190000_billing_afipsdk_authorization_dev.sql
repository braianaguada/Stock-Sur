alter table public.billing_documents
  drop constraint if exists billing_documents_fiscal_status_check,
  add constraint billing_documents_fiscal_status_check check (
    fiscal_status in ('DRAFT', 'READY_TO_AUTHORIZE', 'AUTHORIZING', 'AUTHORIZED', 'REJECTED', 'CANCELLED_INTERNAL')
  );

alter table public.billing_documents
  add column if not exists voucher_date date,
  add column if not exists authorized_by uuid references auth.users(id),
  add column if not exists provider_errors jsonb not null default '[]'::jsonb,
  add column if not exists provider_observations jsonb not null default '[]'::jsonb;

alter table public.billing_settings
  drop constraint if exists billing_settings_credentials_status_check,
  add constraint billing_settings_credentials_status_check check (credentials_status in ('NOT_CONFIGURED', 'CONFIGURED', 'ERROR'));

comment on column public.billing_documents.provider_request is
  'Sanitized AFIP SDK request metadata/payload for homologation audit. Never stores access tokens, certs or private keys.';

comment on column public.billing_documents.provider_response is
  'Sanitized AFIP SDK/ARCA response for homologation audit. Never stores credentials.';
