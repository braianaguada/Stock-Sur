do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'external_invoice_status' and n.nspname = 'public'
  ) then
    create type public.external_invoice_status as enum (
      'ACTIVE',
      'VOIDED'
    );
  end if;
end
$$;

alter table public.documents
  add column if not exists external_invoice_number text null,
  add column if not exists external_invoice_date date null,
  add column if not exists external_invoice_status public.external_invoice_status null,
  add column if not exists external_invoice_updated_at timestamptz null,
  add column if not exists external_invoice_updated_by uuid null references auth.users(id);

create index if not exists documents_external_invoice_idx
  on public.documents(company_id, doc_type, external_invoice_status, external_invoice_number)
  where external_invoice_number is not null;

create or replace function public.clear_external_invoice_on_remito_cancel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.doc_type = 'REMITO'
     and old.status <> 'ANULADO'
     and new.status = 'ANULADO' then
    new.external_invoice_number := null;
    new.external_invoice_date := null;
    new.external_invoice_status := 'VOIDED';
    new.external_invoice_updated_at := now();
    new.external_invoice_updated_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_clear_external_invoice_on_remito_cancel on public.documents;
create trigger trg_documents_clear_external_invoice_on_remito_cancel
before update on public.documents
for each row
execute function public.clear_external_invoice_on_remito_cancel();

create or replace function public.set_document_external_invoice(
  p_document_id uuid,
  p_external_invoice_number text,
  p_external_invoice_date date default null
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_number text;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede asociar factura externa a un remito';
  end if;

  if v_doc.status <> 'EMITIDO' then
    raise exception 'Solo se puede asociar factura externa a un remito emitido';
  end if;

  v_number := nullif(btrim(coalesce(p_external_invoice_number, '')), '');
  if v_number is null then
    raise exception 'El numero de factura externa es obligatorio';
  end if;

  update public.documents
  set external_invoice_number = v_number,
      external_invoice_date = p_external_invoice_date,
      external_invoice_status = 'ACTIVE',
      external_invoice_updated_at = now(),
      external_invoice_updated_by = auth.uid(),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'EXTERNAL_INVOICE_SET',
    jsonb_build_object(
      'external_invoice_number', v_number,
      'external_invoice_date', p_external_invoice_date
    ),
    auth.uid()
  );

  return v_doc;
end;
$$;

create or replace function public.clear_document_external_invoice(
  p_document_id uuid
)
returns public.documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
begin
  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede desvincular factura externa en un remito';
  end if;

  update public.documents
  set external_invoice_number = null,
      external_invoice_date = null,
      external_invoice_status = 'VOIDED',
      external_invoice_updated_at = now(),
      external_invoice_updated_by = auth.uid(),
      updated_at = now()
  where id = v_doc.id
  returning * into v_doc;

  insert into public.document_events (document_id, event_type, payload, created_by)
  values (
    v_doc.id,
    'EXTERNAL_INVOICE_CLEARED',
    jsonb_build_object('external_invoice_status', 'VOIDED'),
    auth.uid()
  );

  return v_doc;
end;
$$;
