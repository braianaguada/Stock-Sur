alter table public.company_settings
  add column if not exists price_rounding_enabled boolean not null default false,
  add column if not exists price_rounding_increment numeric(14,2) null;

alter table public.company_settings
  drop constraint if exists company_settings_price_rounding_increment_check;

alter table public.company_settings
  add constraint company_settings_price_rounding_increment_check
  check (
    price_rounding_increment is null
    or price_rounding_increment in (100, 500, 1000)
  );
