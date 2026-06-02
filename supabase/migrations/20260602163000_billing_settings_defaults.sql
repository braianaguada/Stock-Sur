alter table public.billing_settings
  add column if not exists default_currency text not null default 'ARS',
  add column if not exists default_concept text not null default 'PRODUCTS',
  add column if not exists credentials_status text not null default 'NOT_CONFIGURED';

alter table public.billing_settings
  drop constraint if exists billing_settings_default_currency_check,
  add constraint billing_settings_default_currency_check check (default_currency in ('ARS'));

alter table public.billing_settings
  drop constraint if exists billing_settings_default_concept_check,
  add constraint billing_settings_default_concept_check check (default_concept in ('PRODUCTS'));

alter table public.billing_settings
  drop constraint if exists billing_settings_credentials_status_check,
  add constraint billing_settings_credentials_status_check check (credentials_status in ('NOT_CONFIGURED', 'CONFIGURED'));
