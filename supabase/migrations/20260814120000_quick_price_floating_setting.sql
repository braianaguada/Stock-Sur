alter table public.company_settings
  add column if not exists quick_price_floating_enabled boolean not null default true;

comment on column public.company_settings.quick_price_floating_enabled is
  'Controls whether the company shows the global quick-price floating action.';
