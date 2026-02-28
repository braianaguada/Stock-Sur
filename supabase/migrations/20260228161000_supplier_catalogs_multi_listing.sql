CREATE TABLE IF NOT EXISTS public.supplier_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

ALTER TABLE public.supplier_catalog_versions
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.supplier_catalogs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.supplier_catalog_versions v
SET supplier_id = d.supplier_id
FROM public.supplier_documents d
WHERE v.supplier_document_id = d.id
  AND v.supplier_id IS NULL;

INSERT INTO public.supplier_catalogs (supplier_id, title, notes, created_at, created_by)
SELECT DISTINCT
  d.supplier_id,
  COALESCE(NULLIF(d.title, ''), d.file_name) AS title,
  d.notes,
  d.uploaded_at,
  d.created_by
FROM public.supplier_documents d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.supplier_catalogs c
  WHERE c.supplier_id = d.supplier_id
    AND c.title = COALESCE(NULLIF(d.title, ''), d.file_name)
);

UPDATE public.supplier_catalog_versions v
SET
  catalog_id = c.id,
  title = COALESCE(v.title, d.title, d.file_name),
  created_at = COALESCE(v.created_at, v.imported_at)
FROM public.supplier_documents d
JOIN public.supplier_catalogs c ON c.supplier_id = d.supplier_id AND c.title = COALESCE(NULLIF(d.title, ''), d.file_name)
WHERE v.supplier_document_id = d.id
  AND v.catalog_id IS NULL;

ALTER TABLE public.supplier_catalog_versions
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN catalog_id SET NOT NULL;

ALTER TABLE public.supplier_catalog_lines
  ADD COLUMN IF NOT EXISTS normalized_description TEXT,
  ADD COLUMN IF NOT EXISTS row_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_supplier_catalogs_supplier_id ON public.supplier_catalogs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_versions_supplier_id ON public.supplier_catalog_versions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_versions_catalog_id ON public.supplier_catalog_versions(catalog_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_lines_version_id ON public.supplier_catalog_lines(supplier_catalog_version_id);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_lines_supplier_code ON public.supplier_catalog_lines(supplier_code);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_lines_raw_description ON public.supplier_catalog_lines(raw_description);

ALTER TABLE public.supplier_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_catalogs_read_authenticated" ON public.supplier_catalogs;
DROP POLICY IF EXISTS "supplier_catalogs_insert_owner_or_admin" ON public.supplier_catalogs;
DROP POLICY IF EXISTS "supplier_catalogs_update_owner_or_admin" ON public.supplier_catalogs;
DROP POLICY IF EXISTS "supplier_catalogs_delete_owner_or_admin" ON public.supplier_catalogs;

CREATE POLICY "supplier_catalogs_read_authenticated"
ON public.supplier_catalogs FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_catalogs_insert_owner_or_admin"
ON public.supplier_catalogs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalogs_update_owner_or_admin"
ON public.supplier_catalogs FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalogs_delete_owner_or_admin"
ON public.supplier_catalogs FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
