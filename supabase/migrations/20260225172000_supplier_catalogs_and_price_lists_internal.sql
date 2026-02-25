ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

ALTER TABLE public.price_lists
  ALTER COLUMN supplier_id DROP NOT NULL;

-- Keep legacy relation optional for backward compatibility
ALTER TABLE public.price_lists
  DROP CONSTRAINT IF EXISTS price_lists_supplier_id_fkey;

ALTER TABLE public.price_lists
  ADD CONSTRAINT price_lists_supplier_id_fkey
  FOREIGN KEY (supplier_id)
  REFERENCES public.suppliers(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('xlsx', 'csv', 'pdf')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  source_url TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.supplier_catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_document_id UUID NOT NULL REFERENCES public.supplier_documents(id) ON DELETE CASCADE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS public.supplier_catalog_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_catalog_version_id UUID NOT NULL REFERENCES public.supplier_catalog_versions(id) ON DELETE CASCADE,
  supplier_code TEXT,
  raw_description TEXT NOT NULL,
  cost NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  matched_item_id UUID REFERENCES public.items(id),
  match_status public.match_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_catalog_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_documents_read_authenticated" ON public.supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_insert_owner_or_admin" ON public.supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_update_owner_or_admin" ON public.supplier_documents;
DROP POLICY IF EXISTS "supplier_documents_delete_owner_or_admin" ON public.supplier_documents;

CREATE POLICY "supplier_documents_read_authenticated"
ON public.supplier_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_documents_insert_owner_or_admin"
ON public.supplier_documents FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_documents_update_owner_or_admin"
ON public.supplier_documents FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_documents_delete_owner_or_admin"
ON public.supplier_documents FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "supplier_catalog_versions_read_authenticated" ON public.supplier_catalog_versions;
DROP POLICY IF EXISTS "supplier_catalog_versions_insert_owner_or_admin" ON public.supplier_catalog_versions;
DROP POLICY IF EXISTS "supplier_catalog_versions_update_owner_or_admin" ON public.supplier_catalog_versions;
DROP POLICY IF EXISTS "supplier_catalog_versions_delete_owner_or_admin" ON public.supplier_catalog_versions;

CREATE POLICY "supplier_catalog_versions_read_authenticated"
ON public.supplier_catalog_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_catalog_versions_insert_owner_or_admin"
ON public.supplier_catalog_versions FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalog_versions_update_owner_or_admin"
ON public.supplier_catalog_versions FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalog_versions_delete_owner_or_admin"
ON public.supplier_catalog_versions FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "supplier_catalog_lines_read_authenticated" ON public.supplier_catalog_lines;
DROP POLICY IF EXISTS "supplier_catalog_lines_insert_owner_or_admin" ON public.supplier_catalog_lines;
DROP POLICY IF EXISTS "supplier_catalog_lines_update_owner_or_admin" ON public.supplier_catalog_lines;
DROP POLICY IF EXISTS "supplier_catalog_lines_delete_owner_or_admin" ON public.supplier_catalog_lines;

CREATE POLICY "supplier_catalog_lines_read_authenticated"
ON public.supplier_catalog_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "supplier_catalog_lines_insert_owner_or_admin"
ON public.supplier_catalog_lines FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalog_lines_update_owner_or_admin"
ON public.supplier_catalog_lines FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "supplier_catalog_lines_delete_owner_or_admin"
ON public.supplier_catalog_lines FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
