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
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_number text;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para registrar la factura externa';
  end if;

  select * into v_doc
  from public.documents
  where id = p_document_id
  for update;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_doc.doc_type <> 'REMITO' then
    raise exception 'Solo se puede registrar factura externa en un remito';
  end if;

  if v_doc.status = 'ANULADO' then
    raise exception 'No se puede registrar factura externa en un remito anulado';
  end if;

  perform 1
  from public.cash_sales
  where company_id = v_doc.company_id
    and status <> 'ANULADA'
    and (
      document_id = v_doc.id
      or receipt_kind = 'FACTURA' and receipt_reference = btrim(coalesce(p_external_invoice_number, ''))
    );

  if found then
    raise exception 'No se puede modificar la factura externa porque el remito ya fue usado en caja';
  end if;

  v_number := nullif(btrim(coalesce(p_external_invoice_number, '')), '');
  if v_number is null then
    raise exception 'La factura externa requiere numero';
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
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_invoice_number text;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para quitar la factura externa';
  end if;

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

  v_invoice_number := nullif(btrim(coalesce(v_doc.external_invoice_number, '')), '');
  if v_invoice_number is not null then
    perform 1
    from public.cash_sales
    where company_id = v_doc.company_id
      and status <> 'ANULADA'
      and (
        document_id = v_doc.id
        or receipt_kind = 'FACTURA' and receipt_reference = v_invoice_number
      );

    if found then
      raise exception 'No se puede quitar la factura externa porque el remito ya fue usado en caja';
    end if;
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

create or replace function public.prevent_used_remito_external_invoice_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_number text;
begin
  if new.doc_type <> 'REMITO' then
    return new;
  end if;

  v_invoice_number := nullif(btrim(coalesce(new.external_invoice_number, '')), '');
  if v_invoice_number is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.external_invoice_number, '') = coalesce(new.external_invoice_number, '')
     and coalesce(old.external_invoice_date, 'infinity'::date) = coalesce(new.external_invoice_date, 'infinity'::date)
     and coalesce(old.external_invoice_status, 'VOIDED'::public.external_invoice_status) = coalesce(new.external_invoice_status, 'VOIDED'::public.external_invoice_status) then
    return new;
  end if;

  perform 1
  from public.cash_sales
  where company_id = new.company_id
    and status <> 'ANULADA'
    and (
      document_id = new.id
      or receipt_kind = 'FACTURA' and receipt_reference = v_invoice_number
    );

  if found then
    raise exception 'No se puede modificar la factura externa porque el remito ya fue usado en caja';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_used_remito_external_invoice_changes on public.documents;
create trigger trg_prevent_used_remito_external_invoice_changes
before update of external_invoice_number, external_invoice_date, external_invoice_status
on public.documents
for each row
execute function public.prevent_used_remito_external_invoice_changes();
