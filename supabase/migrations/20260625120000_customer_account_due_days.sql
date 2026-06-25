alter table public.customers
  add column if not exists account_due_days integer not null default 30;

alter table public.customers
  drop constraint if exists customers_account_due_days_check;

alter table public.customers
  add constraint customers_account_due_days_check
  check (account_due_days between 0 and 3650);

