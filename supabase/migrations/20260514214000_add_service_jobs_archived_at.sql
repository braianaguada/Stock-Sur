alter table public.service_jobs
  add column if not exists archived_at timestamptz null;

create index if not exists service_jobs_company_archived_updated_idx
  on public.service_jobs(company_id, archived_at, updated_at desc);

notify pgrst, 'reload schema';
