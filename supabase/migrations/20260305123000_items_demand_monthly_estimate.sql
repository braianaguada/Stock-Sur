alter table public.items
  add column if not exists demand_monthly_estimate numeric null;

alter table public.items
  drop constraint if exists items_demand_monthly_estimate_non_negative;

alter table public.items
  add constraint items_demand_monthly_estimate_non_negative
  check (demand_monthly_estimate is null or demand_monthly_estimate >= 0);
