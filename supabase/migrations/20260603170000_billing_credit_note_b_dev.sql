alter table public.billing_documents
  add column if not exists related_billing_document_id uuid null references public.billing_documents(id) on delete restrict;

alter table public.billing_documents
  drop constraint if exists billing_documents_source_id_fkey,
  drop constraint if exists billing_documents_source_type_check,
  drop constraint if exists billing_documents_invoice_type_check,
  add constraint billing_documents_source_type_check check (source_type in ('CASH_SALE_FROM_REMITO', 'CREDIT_NOTE_FROM_INVOICE')),
  add constraint billing_documents_invoice_type_check check (invoice_type in ('FACTURA_B', 'NOTA_CREDITO_B'));

create index if not exists billing_documents_related_document_idx
  on public.billing_documents(company_id, related_billing_document_id)
  where related_billing_document_id is not null;

create unique index if not exists billing_documents_unique_active_total_credit_note_b_idx
  on public.billing_documents(company_id, related_billing_document_id)
  where document_kind = 'CREDIT_NOTE'
    and invoice_type = 'NOTA_CREDITO_B'
    and fiscal_status <> 'CANCELLED_INTERNAL';

create or replace function public.create_billing_credit_note_b_from_invoice(
  p_billing_document_id uuid
)
returns public.billing_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_invoice public.billing_documents%rowtype;
  v_settings public.billing_settings%rowtype;
  v_existing_id uuid;
  v_doc public.billing_documents%rowtype;
  v_line_count integer;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para crear una Nota de Credito B';
  end if;

  select *
  into v_invoice
  from public.billing_documents
  where id = p_billing_document_id
  for update;

  if not found then
    raise exception 'Factura fiscal original no encontrada';
  end if;

  if not public.is_company_member(v_actor, v_invoice.company_id)
     or not public.has_company_permission(v_actor, v_invoice.company_id, 'billing.credit_note') then
    raise exception 'No tienes permisos para crear notas de credito fiscales';
  end if;

  if v_invoice.document_kind <> 'INVOICE' then
    raise exception 'La Nota de Credito B solo puede nacer desde una factura';
  end if;

  if v_invoice.invoice_type <> 'FACTURA_B' then
    raise exception 'Solo se admite Nota de Credito B desde Factura B';
  end if;

  if v_invoice.fiscal_status <> 'AUTHORIZED' or v_invoice.cae is null or v_invoice.voucher_number is null then
    raise exception 'La Factura B debe estar autorizada para crear una Nota de Credito B';
  end if;

  select id
  into v_existing_id
  from public.billing_documents
  where company_id = v_invoice.company_id
    and related_billing_document_id = v_invoice.id
    and document_kind = 'CREDIT_NOTE'
    and invoice_type = 'NOTA_CREDITO_B'
    and fiscal_status <> 'CANCELLED_INTERNAL'
  limit 1;

  if v_existing_id is not null then
    raise exception 'Ya existe una Nota de Credito B activa para esta factura';
  end if;

  select count(*)
  into v_line_count
  from public.billing_document_lines
  where billing_document_id = v_invoice.id;

  if v_line_count = 0 then
    raise exception 'La factura original no tiene lineas para copiar';
  end if;

  select *
  into v_settings
  from public.billing_settings
  where company_id = v_invoice.company_id
    and provider = 'AFIPSDK'
    and environment = 'dev'
    and is_enabled = true
  limit 1;

  if not found then
    raise exception 'Facturacion AFIPSDK dev no esta habilitada para esta empresa';
  end if;

  insert into public.billing_documents (
    company_id,
    source_type,
    source_id,
    source_remito_id,
    related_billing_document_id,
    document_kind,
    invoice_type,
    fiscal_status,
    provider,
    environment,
    issuer_tax_id,
    issuer_name,
    issuer_tax_condition,
    receiver_name,
    receiver_doc_type,
    receiver_doc_number,
    receiver_tax_condition,
    currency,
    currency_rate,
    subtotal,
    discount_total,
    tax_total,
    total,
    point_of_sale,
    created_by
  )
  values (
    v_invoice.company_id,
    'CREDIT_NOTE_FROM_INVOICE',
    v_invoice.id,
    v_invoice.source_remito_id,
    v_invoice.id,
    'CREDIT_NOTE',
    'NOTA_CREDITO_B',
    'DRAFT',
    'AFIPSDK',
    'dev',
    coalesce(v_invoice.issuer_tax_id, v_settings.issuer_tax_id),
    coalesce(v_invoice.issuer_name, v_settings.issuer_name),
    coalesce(v_invoice.issuer_tax_condition, v_settings.issuer_tax_condition),
    v_invoice.receiver_name,
    v_invoice.receiver_doc_type,
    v_invoice.receiver_doc_number,
    v_invoice.receiver_tax_condition,
    v_invoice.currency,
    v_invoice.currency_rate,
    v_invoice.subtotal,
    v_invoice.discount_total,
    v_invoice.tax_total,
    v_invoice.total,
    v_invoice.point_of_sale,
    v_actor
  )
  returning * into v_doc;

  insert into public.billing_document_lines (
    billing_document_id,
    source_document_line_id,
    line_order,
    item_id,
    sku_snapshot,
    description,
    unit,
    quantity,
    unit_price,
    discount_pct,
    discount_total,
    vat_rate,
    net_amount,
    vat_amount,
    total,
    created_by
  )
  select
    v_doc.id,
    source_document_line_id,
    line_order,
    item_id,
    sku_snapshot,
    description,
    unit,
    quantity,
    unit_price,
    discount_pct,
    discount_total,
    vat_rate,
    net_amount,
    vat_amount,
    total,
    v_actor
  from public.billing_document_lines
  where billing_document_id = v_invoice.id
  order by line_order;

  insert into public.billing_events (
    company_id,
    billing_document_id,
    event_type,
    payload,
    created_by
  )
  values (
    v_doc.company_id,
    v_doc.id,
    'CREDIT_NOTE_DRAFT_CREATED',
    jsonb_build_object(
      'source_type', v_doc.source_type,
      'related_billing_document_id', v_invoice.id,
      'related_voucher_full_number', v_invoice.voucher_full_number,
      'invoice_type', v_doc.invoice_type,
      'fiscal_status', v_doc.fiscal_status,
      'total_credit_note', true,
      'provider_call', false,
      'stock_mutation', false,
      'cash_mutation', false,
      'customer_account_mutation', false
    ),
    v_actor
  );

  return v_doc;
end;
$$;

revoke all on function public.create_billing_credit_note_b_from_invoice(uuid) from public;
grant execute on function public.create_billing_credit_note_b_from_invoice(uuid) to authenticated;
