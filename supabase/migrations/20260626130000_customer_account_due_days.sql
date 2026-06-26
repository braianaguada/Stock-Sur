alter table public.customers
  add column if not exists account_due_days integer not null default 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_account_due_days_range'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_account_due_days_range
      check (account_due_days between 0 and 365);
  end if;
end $$;
