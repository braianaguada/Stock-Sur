alter table public.company_settings
  add column if not exists auto_close_cash_enabled boolean not null default false,
  add column if not exists auto_close_cash_time time null;

update public.company_settings
set auto_close_cash_enabled = coalesce(auto_close_cash_enabled, false);
