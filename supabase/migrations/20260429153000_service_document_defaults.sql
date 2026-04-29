alter table public.company_settings
  add column if not exists service_default_intro_text text null,
  add column if not exists service_default_closing_text text null,
  add column if not exists service_default_delivery_time text null,
  add column if not exists service_default_payment_terms text null,
  add column if not exists service_default_delivery_location text null,
  add column if not exists service_default_valid_days integer null;

update public.company_settings
set
  service_default_intro_text = coalesce(service_default_intro_text, document_tagline),
  service_default_closing_text = coalesce(service_default_closing_text, document_footer),
  service_default_delivery_time = coalesce(service_default_delivery_time, 'A coordinar segun disponibilidad operativa.'),
  service_default_payment_terms = coalesce(service_default_payment_terms, '50% de anticipo y saldo contra finalizacion del servicio.'),
  service_default_delivery_location = coalesce(service_default_delivery_location, address),
  service_default_valid_days = coalesce(service_default_valid_days, 15);
