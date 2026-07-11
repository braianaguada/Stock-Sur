alter table public.suppliers
  add column if not exists legal_name text,
  add column if not exists tax_id text,
  add column if not exists address text,
  add column if not exists default_currency text;

alter table public.suppliers
  add constraint suppliers_name_not_blank
    check (btrim(name) <> '') not valid,
  add constraint suppliers_default_currency_check
    check (default_currency is null or default_currency in ('ARS', 'USD')) not valid,
  add constraint suppliers_tax_id_check
    check (tax_id is null or tax_id ~ '^[0-9]{11}$') not valid;

alter table public.suppliers validate constraint suppliers_name_not_blank;
alter table public.suppliers validate constraint suppliers_default_currency_check;
alter table public.suppliers validate constraint suppliers_tax_id_check;

create index if not exists suppliers_company_tax_id_idx
  on public.suppliers (company_id, tax_id)
  where tax_id is not null;

alter table public.supplier_catalogs
  add column if not exists currency text,
  add column if not exists list_date date,
  add column if not exists valid_from date,
  add column if not exists valid_to date,
  add column if not exists status text not null default 'ACTIVE',
  add column if not exists updated_at timestamptz not null default now();

alter table public.supplier_catalogs
  add constraint supplier_catalogs_currency_check
    check (currency is null or currency in ('ARS', 'USD')) not valid,
  add constraint supplier_catalogs_status_check
    check (status in ('ACTIVE', 'ARCHIVED')) not valid,
  add constraint supplier_catalogs_validity_check
    check (valid_to is null or valid_from is null or valid_to >= valid_from) not valid;

alter table public.supplier_catalogs validate constraint supplier_catalogs_currency_check;
alter table public.supplier_catalogs validate constraint supplier_catalogs_status_check;
alter table public.supplier_catalogs validate constraint supplier_catalogs_validity_check;

create index if not exists supplier_catalogs_company_supplier_status_idx
  on public.supplier_catalogs (company_id, supplier_id, status, created_at desc);

alter table public.supplier_catalog_versions
  add column if not exists currency text,
  add column if not exists list_date date,
  add column if not exists accepted_row_count integer,
  add column if not exists rejected_row_count integer;

alter table public.supplier_catalog_versions
  add constraint supplier_catalog_versions_currency_check
    check (currency is null or currency in ('ARS', 'USD')) not valid,
  add constraint supplier_catalog_versions_accepted_count_check
    check (accepted_row_count is null or accepted_row_count >= 0) not valid,
  add constraint supplier_catalog_versions_rejected_count_check
    check (rejected_row_count is null or rejected_row_count >= 0) not valid;

alter table public.supplier_catalog_versions validate constraint supplier_catalog_versions_currency_check;
alter table public.supplier_catalog_versions validate constraint supplier_catalog_versions_accepted_count_check;
alter table public.supplier_catalog_versions validate constraint supplier_catalog_versions_rejected_count_check;

create index if not exists supplier_catalog_versions_company_catalog_imported_idx
  on public.supplier_catalog_versions (company_id, catalog_id, imported_at desc);

comment on column public.suppliers.tax_id is
  'CUIT normalizado a 11 digitos, sin separadores.';
comment on column public.supplier_catalogs.currency is
  'Moneda declarada de la lista. NULL conserva historicos sin inferir moneda.';
comment on column public.supplier_catalog_versions.currency is
  'Snapshot de moneda declarado al importar. NULL significa no confirmado.';
