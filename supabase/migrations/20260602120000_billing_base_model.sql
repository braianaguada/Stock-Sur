create table if not exists public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'AFIPSDK',
  environment text not null default 'dev',
  is_enabled boolean not null default false,
  issuer_tax_id text null,
  issuer_name text null,
  issuer_tax_condition text null,
  notes text null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_settings_provider_check check (provider in ('AFIPSDK')),
  constraint billing_settings_environment_check check (environment in ('dev', 'prod')),
  unique (company_id, provider, environment)
);

create table if not exists public.billing_points_of_sale (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  billing_settings_id uuid not null references public.billing_settings(id) on delete cascade,
  point_of_sale integer not null,
  description text null,
  is_enabled boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_points_of_sale_number_check check (point_of_sale > 0),
  unique (company_id, billing_settings_id, point_of_sale)
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null,
  source_id uuid not null references public.cash_sales(id) on delete restrict,
  source_remito_id uuid null references public.documents(id) on delete restrict,
  document_kind text not null,
  invoice_type text not null,
  fiscal_status text not null default 'DRAFT',
  provider text not null default 'AFIPSDK',
  environment text not null default 'dev',
  issuer_tax_id text null,
  issuer_name text null,
  issuer_tax_condition text null,
  receiver_name text not null default 'Consumidor Final',
  receiver_doc_type text not null default '99',
  receiver_doc_number text null,
  receiver_tax_condition text not null default 'CONSUMIDOR_FINAL',
  currency text not null default 'ARS',
  currency_rate numeric(14,6) null,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  point_of_sale integer null,
  voucher_number integer null,
  voucher_full_number text null,
  cae text null,
  cae_expires_at date null,
  authorized_at timestamptz null,
  provider_request jsonb null,
  provider_response jsonb null,
  error_message text null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_documents_source_type_check check (source_type in ('CASH_SALE_FROM_REMITO')),
  constraint billing_documents_kind_check check (document_kind in ('INVOICE', 'CREDIT_NOTE')),
  constraint billing_documents_invoice_type_check check (invoice_type in ('FACTURA_B')),
  constraint billing_documents_status_check check (
    fiscal_status in ('DRAFT', 'READY_TO_AUTHORIZE', 'AUTHORIZED', 'REJECTED', 'CANCELLED_INTERNAL')
  ),
  constraint billing_documents_provider_check check (provider in ('AFIPSDK')),
  constraint billing_documents_environment_check check (environment in ('dev', 'prod')),
  constraint billing_documents_no_cae_for_draft_check check (
    fiscal_status <> 'DRAFT'
    or (cae is null and voucher_number is null and voucher_full_number is null and authorized_at is null)
  )
);

create table if not exists public.billing_document_lines (
  id uuid primary key default gen_random_uuid(),
  billing_document_id uuid not null references public.billing_documents(id) on delete cascade,
  source_document_line_id uuid null references public.document_lines(id) on delete set null,
  line_order integer not null default 1,
  item_id uuid null references public.items(id) on delete set null,
  sku_snapshot text null,
  description text not null,
  unit text null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  discount_pct numeric(8,4) not null default 0,
  discount_total numeric(14,2) not null default 0,
  vat_rate numeric(8,4) not null default 0,
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  billing_document_id uuid not null references public.billing_documents(id) on delete cascade,
  event_type text not null,
  payload jsonb null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists billing_settings_company_idx
  on public.billing_settings(company_id, provider, environment);

create index if not exists billing_points_of_sale_company_idx
  on public.billing_points_of_sale(company_id, is_enabled);

create index if not exists billing_documents_company_status_idx
  on public.billing_documents(company_id, fiscal_status, created_at desc);

create index if not exists billing_documents_source_idx
  on public.billing_documents(company_id, source_type, source_id);

create unique index if not exists billing_documents_unique_active_invoice_source_idx
  on public.billing_documents(company_id, source_type, source_id)
  where document_kind = 'INVOICE'
    and fiscal_status <> 'CANCELLED_INTERNAL';

create index if not exists billing_document_lines_document_idx
  on public.billing_document_lines(billing_document_id, line_order);

create index if not exists billing_events_document_idx
  on public.billing_events(billing_document_id, created_at desc);

create trigger update_billing_settings_updated_at
before update on public.billing_settings
for each row execute function public.update_updated_at_column();

create trigger update_billing_points_of_sale_updated_at
before update on public.billing_points_of_sale
for each row execute function public.update_updated_at_column();

create trigger update_billing_documents_updated_at
before update on public.billing_documents
for each row execute function public.update_updated_at_column();

create trigger update_billing_document_lines_updated_at
before update on public.billing_document_lines
for each row execute function public.update_updated_at_column();

insert into public.permissions (code, module, action, description)
values
  ('billing.view', 'billing', 'view', 'Ver comprobantes fiscales internos'),
  ('billing.create', 'billing', 'create', 'Crear borradores fiscales internos'),
  ('billing.authorize', 'billing', 'authorize', 'Autorizar comprobantes fiscales'),
  ('billing.credit_note', 'billing', 'credit_note', 'Crear notas de credito fiscales'),
  ('billing.print', 'billing', 'print', 'Imprimir comprobantes fiscales'),
  ('billing.settings', 'billing', 'settings', 'Administrar configuracion fiscal')
on conflict (code) do update
set module = excluded.module,
    action = excluded.action,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code like 'billing.%'
where r.code = 'admin' and r.scope = 'COMPANY'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('billing.view', 'billing.create', 'billing.print')
where r.code = 'operador' and r.scope = 'COMPANY'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'billing.view'
where r.code = 'consulta' and r.scope = 'COMPANY'
on conflict do nothing;

alter table public.billing_settings enable row level security;
alter table public.billing_points_of_sale enable row level security;
alter table public.billing_documents enable row level security;
alter table public.billing_document_lines enable row level security;
alter table public.billing_events enable row level security;

create policy "billing_settings_read_company_member"
on public.billing_settings
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.view')
);

create policy "billing_settings_manage_company_member"
on public.billing_settings
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.settings')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'billing.settings')
);

create policy "billing_points_of_sale_read_company_member"
on public.billing_points_of_sale
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.view')
);

create policy "billing_points_of_sale_manage_company_member"
on public.billing_points_of_sale
for all
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.settings')
)
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'billing.settings')
);

create policy "billing_documents_read_company_member"
on public.billing_documents
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.view')
);

create policy "billing_documents_insert_company_member"
on public.billing_documents
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'billing.create')
  and created_by = auth.uid()
  and fiscal_status = 'DRAFT'
  and cae is null
  and voucher_number is null
);

create policy "billing_documents_update_draft_company_member"
on public.billing_documents
for update
to authenticated
using (
  fiscal_status in ('DRAFT', 'REJECTED')
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.create')
)
with check (
  fiscal_status in ('DRAFT', 'REJECTED', 'READY_TO_AUTHORIZE')
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.create')
  and cae is null
  and voucher_number is null
);

create policy "billing_document_lines_read_company_member"
on public.billing_document_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.billing_documents bd
    where bd.id = billing_document_id
      and public.is_company_member(auth.uid(), bd.company_id)
      and public.has_company_permission(auth.uid(), bd.company_id, 'billing.view')
  )
);

create policy "billing_document_lines_insert_company_member"
on public.billing_document_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.billing_documents bd
    where bd.id = billing_document_id
      and bd.fiscal_status in ('DRAFT', 'REJECTED')
      and bd.created_by = auth.uid()
      and public.has_company_permission(auth.uid(), bd.company_id, 'billing.create')
  )
);

create policy "billing_document_lines_update_company_member"
on public.billing_document_lines
for update
to authenticated
using (
  exists (
    select 1
    from public.billing_documents bd
    where bd.id = billing_document_id
      and bd.fiscal_status in ('DRAFT', 'REJECTED')
      and public.has_company_permission(auth.uid(), bd.company_id, 'billing.create')
  )
)
with check (
  exists (
    select 1
    from public.billing_documents bd
    where bd.id = billing_document_id
      and bd.fiscal_status in ('DRAFT', 'REJECTED')
      and public.has_company_permission(auth.uid(), bd.company_id, 'billing.create')
  )
);

create policy "billing_document_lines_delete_company_member"
on public.billing_document_lines
for delete
to authenticated
using (
  exists (
    select 1
    from public.billing_documents bd
    where bd.id = billing_document_id
      and bd.fiscal_status in ('DRAFT', 'REJECTED')
      and public.has_company_permission(auth.uid(), bd.company_id, 'billing.create')
  )
);

create policy "billing_events_read_company_member"
on public.billing_events
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'billing.view')
);

create policy "billing_events_insert_company_member"
on public.billing_events
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and (
    public.has_company_permission(auth.uid(), company_id, 'billing.create')
    or public.has_company_permission(auth.uid(), company_id, 'billing.authorize')
    or public.has_company_permission(auth.uid(), company_id, 'billing.credit_note')
  )
);

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
  v_existing_id uuid;
  v_doc public.billing_documents%rowtype;
  v_line_count integer;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para crear un borrador fiscal';
  end if;

  if p_invoice_type <> 'FACTURA_B' then
    raise exception 'Solo se admite Factura B en esta etapa';
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
    'FACTURA_B',
    'DRAFT',
    'AFIPSDK',
    v_settings.environment,
    v_settings.issuer_tax_id,
    v_settings.issuer_name,
    v_settings.issuer_tax_condition,
    'Consumidor Final',
    '99',
    null,
    'CONSUMIDOR_FINAL',
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
    dl.line_total,
    0,
    dl.line_total,
    v_actor
  from public.document_lines dl
  where dl.document_id = v_remito.id
  order by dl.line_order;

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
      'cae', null
    ),
    v_actor
  );

  return v_doc;
end;
$$;

revoke all on function public.create_billing_draft_from_cash_sale(uuid, text) from public;
grant execute on function public.create_billing_draft_from_cash_sale(uuid, text) to authenticated;
