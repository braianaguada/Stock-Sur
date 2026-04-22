alter table public.documents
  add column if not exists issued_at timestamptz null;

update public.documents
set issued_at = created_at
where issued_at is null
  and status = 'EMITIDO';
