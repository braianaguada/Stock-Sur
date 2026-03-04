ALTER TABLE public.supplier_import_mappings
  ADD COLUMN IF NOT EXISTS file_type TEXT NOT NULL DEFAULT 'xlsx';

UPDATE public.supplier_import_mappings
SET file_type = 'xlsx'
WHERE file_type IS NULL OR file_type = '';

ALTER TABLE public.supplier_import_mappings
  DROP CONSTRAINT IF EXISTS supplier_import_mappings_supplier_id_key;

DROP INDEX IF EXISTS idx_supplier_import_mappings_supplier_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_import_mappings_supplier_file_type
  ON public.supplier_import_mappings (supplier_id, file_type);

CREATE INDEX IF NOT EXISTS idx_supplier_import_mappings_supplier_file
  ON public.supplier_import_mappings (supplier_id, file_type, created_at DESC);
