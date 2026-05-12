create extension if not exists pg_trgm;

create index if not exists items_company_name_trgm_idx
  on public.items using gin (name gin_trgm_ops)
  where name is not null;

create index if not exists items_company_sku_trgm_idx
  on public.items using gin (sku gin_trgm_ops)
  where sku is not null;

create index if not exists items_company_supplier_trgm_idx
  on public.items using gin (supplier gin_trgm_ops)
  where supplier is not null;

create index if not exists items_company_brand_trgm_idx
  on public.items using gin (brand gin_trgm_ops)
  where brand is not null;

create index if not exists items_company_model_trgm_idx
  on public.items using gin (model gin_trgm_ops)
  where model is not null;

create index if not exists items_company_attributes_trgm_idx
  on public.items using gin (attributes gin_trgm_ops)
  where attributes is not null;

create index if not exists customers_company_name_trgm_idx
  on public.customers using gin (name gin_trgm_ops)
  where name is not null;

create index if not exists customers_company_cuit_trgm_idx
  on public.customers using gin (cuit gin_trgm_ops)
  where cuit is not null;

create index if not exists suppliers_company_name_trgm_idx
  on public.suppliers using gin (name gin_trgm_ops)
  where name is not null;

create index if not exists suppliers_company_contact_name_trgm_idx
  on public.suppliers using gin (contact_name gin_trgm_ops)
  where contact_name is not null;

create index if not exists documents_company_customer_name_trgm_idx
  on public.documents using gin (customer_name gin_trgm_ops)
  where customer_name is not null;

create index if not exists documents_company_external_invoice_trgm_idx
  on public.documents using gin (external_invoice_number gin_trgm_ops)
  where external_invoice_number is not null;

create index if not exists documents_company_doc_number_idx
  on public.documents (company_id, document_number);
