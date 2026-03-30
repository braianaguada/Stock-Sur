alter table public.items
  add column if not exists model text;

notify pgrst, 'reload schema';
