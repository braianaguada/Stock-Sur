alter table public.service_jobs
  add column if not exists archived_by uuid null references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
