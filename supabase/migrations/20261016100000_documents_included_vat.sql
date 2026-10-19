begin;

-- Commercial prices include VAT. This creates no stock, cash or ledger entries.
create function public.normalize_document_included_vat()
returns trigger language plpgsql set search_path = public as $$
begin
  new.subtotal := round(new.total / 1.21, 2);
  new.tax_total := new.total - new.subtotal;
  return new;
end;
$$;
revoke all on function public.normalize_document_included_vat() from public, anon, authenticated;

create trigger normalize_document_included_vat
before insert or update of total on public.documents
for each row execute function public.normalize_document_included_vat();

-- Repair only the old zero-tax signature. Preserve existing fiscal sources.
update public.documents d
set subtotal = round(d.total / 1.21, 2),
    tax_total = d.total - round(d.total / 1.21, 2)
where d.total <> 0 and d.tax_total = 0 and d.subtotal = d.total
  and not exists (
    select 1 from public.billing_documents b
    where b.company_id = d.company_id and b.source_remito_id = d.id
  );

alter table public.document_lines alter column tax_pct set default 21;
update public.document_lines l set tax_pct = 21
from public.documents d
where d.id = l.document_id and l.tax_pct = 0
  and d.tax_total = d.total - round(d.total / 1.21, 2)
  and not exists (
    select 1 from public.billing_documents b
    where b.company_id = d.company_id and b.source_remito_id = d.id
  );

-- Preserve the existing fiscal workflow and permissions; correct only its line breakdown.
create or replace function public.create_billing_draft_from_cash_sale(
  p_cash_sale_id uuid,
  p_invoice_type text default 'FACTURA_B'
)
returns public.billing_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_sale public.cash_sales%rowtype;
  v_remito public.documents%rowtype;
  v_settings public.billing_settings%rowtype;
  v_customer public.customers%rowtype;
  v_profile public.customer_fiscal_profiles%rowtype;
  v_existing_id uuid;
  v_doc public.billing_documents%rowtype;
  v_line_count integer;
  v_invoice_type text := upper(trim(coalesce(p_invoice_type, 'FACTURA_B')));
  v_tax_id text;
  v_checksum_sum integer;
  v_checksum_mod integer;
  v_checksum_verifier integer;
  v_receiver_name text := 'Consumidor Final';
  v_receiver_doc_type text := '99';
  v_receiver_doc_number text := null;
  v_receiver_tax_condition text := 'CONSUMIDOR_FINAL';
  v_receiver_snapshot jsonb := null;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para crear un borrador fiscal';
  end if;

  if v_invoice_type not in ('FACTURA_B', 'FACTURA_A') then
    raise exception 'Solo se admite Factura B o borrador Factura A en esta etapa';
  end if;

  select *
  into v_sale
  from public.cash_sales
  where id = p_cash_sale_id
  for update;

  if not found then
    raise exception 'Venta de caja no encontrada';
  end if;

  if not public.is_company_member(v_actor, v_sale.company_id)
     or not public.has_company_permission(v_actor, v_sale.company_id, 'billing.create') then
    raise exception 'No tienes permisos para crear borradores fiscales';
  end if;

  if v_sale.status = 'ANULADA' then
    raise exception 'No se puede facturar una venta anulada';
  end if;

  if v_sale.receipt_kind <> 'REMITO' or v_sale.document_id is null then
    raise exception 'La venta debe estar asociada a un remito';
  end if;

  select *
  into v_remito
  from public.documents
  where id = v_sale.document_id;

  if not found then
    raise exception 'Remito asociado no encontrado';
  end if;

  if v_remito.company_id <> v_sale.company_id then
    raise exception 'La venta y el remito deben pertenecer a la misma empresa';
  end if;

  if v_remito.doc_type <> 'REMITO' or v_remito.status <> 'EMITIDO' then
    raise exception 'Solo se puede crear borrador fiscal desde un REMITO EMITIDO';
  end if;

  select id
  into v_existing_id
  from public.billing_documents
  where company_id = v_sale.company_id
    and source_type = 'CASH_SALE_FROM_REMITO'
    and source_id = v_sale.id
    and document_kind = 'INVOICE'
    and fiscal_status <> 'CANCELLED_INTERNAL'
  limit 1;

  if v_existing_id is not null then
    raise exception 'Ya existe un borrador o comprobante fiscal activo para esta venta';
  end if;

  select count(*)
  into v_line_count
  from public.document_lines
  where document_id = v_remito.id;

  if v_line_count = 0 then
    raise exception 'El remito no tiene lineas para copiar';
  end if;

  select *
  into v_settings
  from public.billing_settings
  where company_id = v_sale.company_id
    and provider = 'AFIPSDK'
    and is_enabled = true
  order by case when environment = 'dev' then 0 else 1 end
  limit 1;

  if not found then
    raise exception 'Facturacion no esta habilitada para esta empresa';
  end if;

  if v_invoice_type = 'FACTURA_A' then
    if v_remito.customer_id is null then
      raise exception 'Factura A exige cliente registrado y no admite consumidor final';
    end if;

    select *
    into v_customer
    from public.customers
    where id = v_remito.customer_id
      and company_id = v_sale.company_id;

    if not found then
      raise exception 'Cliente de remito no encontrado para Factura A';
    end if;

    if coalesce(v_customer.is_occasional, false) then
      raise exception 'Factura A no admite cliente ocasional';
    end if;

    select *
    into v_profile
    from public.customer_fiscal_profiles
    where company_id = v_sale.company_id
      and customer_id = v_customer.id
    limit 1;

    if not found then
      raise exception 'El cliente no tiene perfil fiscal';
    end if;

    v_tax_id := regexp_replace(coalesce(v_profile.tax_id, ''), '\D', '', 'g');

    if length(v_tax_id) <> 11 then
      raise exception 'El perfil fiscal no tiene CUIT valido';
    end if;

    v_checksum_sum :=
      substring(v_tax_id from 1 for 1)::integer * 5 +
      substring(v_tax_id from 2 for 1)::integer * 4 +
      substring(v_tax_id from 3 for 1)::integer * 3 +
      substring(v_tax_id from 4 for 1)::integer * 2 +
      substring(v_tax_id from 5 for 1)::integer * 7 +
      substring(v_tax_id from 6 for 1)::integer * 6 +
      substring(v_tax_id from 7 for 1)::integer * 5 +
      substring(v_tax_id from 8 for 1)::integer * 4 +
      substring(v_tax_id from 9 for 1)::integer * 3 +
      substring(v_tax_id from 10 for 1)::integer * 2;
    v_checksum_mod := v_checksum_sum % 11;
    v_checksum_verifier := case
      when v_checksum_mod = 0 then 0
      when v_checksum_mod = 1 then 9
      else 11 - v_checksum_mod
    end;

    if v_checksum_verifier <> substring(v_tax_id from 11 for 1)::integer then
      raise exception 'El perfil fiscal no tiene CUIT valido';
    end if;

    if nullif(trim(coalesce(v_profile.legal_name, '')), '') is null then
      raise exception 'El perfil fiscal no tiene razon social oficial';
    end if;

    if v_profile.validation_status <> 'VALIDATED_AUTO' then
      raise exception 'El perfil fiscal todavia no esta validado automaticamente';
    end if;

    if v_profile.legal_name_source <> 'OFFICIAL' then
      raise exception 'La razon social debe venir de la constancia oficial';
    end if;

    if v_profile.tax_condition_source <> 'OFFICIAL_DERIVED' then
      raise exception 'La condicion IVA debe derivarse automaticamente de datos oficiales';
    end if;

    if v_profile.tax_condition <> 'RESPONSABLE_INSCRIPTO' then
      raise exception 'Factura A solo se habilita para Responsable Inscripto en esta fase';
    end if;

    if v_profile.taxpayer_status <> 'ACTIVO' then
      raise exception 'El CUIT debe estar activo en la constancia oficial';
    end if;

    if coalesce(v_profile.validation_source, '') ~* '(mock|fixture|test)' then
      raise exception 'Los perfiles mock no habilitan Factura A';
    end if;

    v_receiver_name := trim(v_profile.legal_name);
    v_receiver_doc_type := '80';
    v_receiver_doc_number := v_tax_id;
    v_receiver_tax_condition := 'RESPONSABLE_INSCRIPTO';
    v_receiver_snapshot := jsonb_build_object(
      'customer_id', v_customer.id,
      'legal_name', v_receiver_name,
      'tax_id', v_tax_id,
      'tax_condition', v_profile.tax_condition,
      'fiscal_address', v_profile.fiscal_address,
      'validation_status', v_profile.validation_status,
      'validation_source', v_profile.validation_source,
      'tax_condition_source', v_profile.tax_condition_source,
      'legal_name_source', v_profile.legal_name_source,
      'taxpayer_status', v_profile.taxpayer_status,
      'validated_at', v_profile.validated_at,
      'snapshot_created_at', now(),
      'source', 'customer_fiscal_profiles'
    );
  end if;

  insert into public.billing_documents (
    company_id,
    source_type,
    source_id,
    source_remito_id,
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
    receiver_fiscal_snapshot,
    subtotal,
    discount_total,
    tax_total,
    total,
    created_by
  )
  values (
    v_sale.company_id,
    'CASH_SALE_FROM_REMITO',
    v_sale.id,
    v_remito.id,
    'INVOICE',
    v_invoice_type,
    'DRAFT',
    'AFIPSDK',
    v_settings.environment,
    v_settings.issuer_tax_id,
    v_settings.issuer_name,
    v_settings.issuer_tax_condition,
    v_receiver_name,
    v_receiver_doc_type,
    v_receiver_doc_number,
    v_receiver_tax_condition,
    v_receiver_snapshot,
    coalesce(v_remito.subtotal, 0),
    coalesce(v_remito.discount_total, 0),
    coalesce(v_remito.tax_total, 0),
    coalesce(v_remito.total, v_sale.amount_total, 0),
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
    dl.id,
    dl.line_order,
    dl.item_id,
    dl.sku_snapshot,
    dl.description,
    dl.unit,
    dl.quantity,
    dl.unit_price,
    dl.discount_pct,
    greatest(round((dl.quantity * dl.unit_price) - dl.line_total, 2), 0),
    coalesce(dl.tax_pct, 0),
    case when v_remito.tax_total > 0 and dl.tax_pct > 0 then round(dl.line_total / (1 + dl.tax_pct / 100), 2) else dl.line_total end,
    case when v_remito.tax_total > 0 and dl.tax_pct > 0 then dl.line_total - round(dl.line_total / (1 + dl.tax_pct / 100), 2) else 0 end,
    dl.line_total,
    v_actor
  from public.document_lines dl
  where dl.document_id = v_remito.id
  order by dl.line_order;

  if v_doc.tax_total > 0 then
  update public.billing_document_lines l
  set net_amount = l.net_amount + v_doc.subtotal - (
        select sum(x.net_amount) from public.billing_document_lines x where x.billing_document_id = v_doc.id
      ),
      vat_amount = l.vat_amount + v_doc.tax_total - (
        select sum(x.vat_amount) from public.billing_document_lines x where x.billing_document_id = v_doc.id
      )
  where l.id = (
    select x.id from public.billing_document_lines x where x.billing_document_id = v_doc.id
    order by x.line_order desc, x.id desc limit 1
  );

  end if;

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
    'DRAFT_CREATED',
    jsonb_build_object(
      'source_type', v_doc.source_type,
      'cash_sale_id', v_sale.id,
      'remito_id', v_remito.id,
      'invoice_type', v_doc.invoice_type,
      'fiscal_status', v_doc.fiscal_status,
      'provider_call', false,
      'cae', null,
      'receiver_fiscal_snapshot_present', v_receiver_snapshot is not null
    ),
    v_actor
  );

  return v_doc;
end;
$$;

revoke all on function public.create_billing_draft_from_cash_sale(uuid, text) from public;
grant execute on function public.create_billing_draft_from_cash_sale(uuid, text) to authenticated;

commit;
