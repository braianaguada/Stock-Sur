create extension if not exists pg_trgm;

create index if not exists supplier_catalog_lines_raw_description_trgm_idx
  on public.supplier_catalog_lines using gin (raw_description gin_trgm_ops);

create index if not exists supplier_catalog_lines_normalized_description_trgm_idx
  on public.supplier_catalog_lines using gin (normalized_description gin_trgm_ops);

create index if not exists supplier_catalog_lines_supplier_code_trgm_idx
  on public.supplier_catalog_lines using gin (supplier_code gin_trgm_ops)
  where supplier_code is not null;

create index if not exists supplier_catalog_lines_product_name_trgm_idx
  on public.supplier_catalog_lines using gin (product_name gin_trgm_ops)
  where product_name is not null;

comment on index public.supplier_catalog_lines_raw_description_trgm_idx is
  'Acelera la búsqueda operativa del comparador; el aislamiento continúa en RLS y company_id.';
