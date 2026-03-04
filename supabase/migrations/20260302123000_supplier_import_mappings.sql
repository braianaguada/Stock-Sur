CREATE TABLE IF NOT EXISTS public.supplier_import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  mapping JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_import_mappings_supplier_id
  ON public.supplier_import_mappings (supplier_id);

CREATE OR REPLACE FUNCTION public.set_supplier_import_mappings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_import_mappings_updated_at ON public.supplier_import_mappings;
CREATE TRIGGER trg_supplier_import_mappings_updated_at
BEFORE UPDATE ON public.supplier_import_mappings
FOR EACH ROW
EXECUTE FUNCTION public.set_supplier_import_mappings_updated_at();

ALTER TABLE public.supplier_import_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_import_mappings_select_owner_or_admin" ON public.supplier_import_mappings;
DROP POLICY IF EXISTS "supplier_import_mappings_insert_owner_or_admin" ON public.supplier_import_mappings;
DROP POLICY IF EXISTS "supplier_import_mappings_update_owner_or_admin" ON public.supplier_import_mappings;
DROP POLICY IF EXISTS "supplier_import_mappings_delete_owner_or_admin" ON public.supplier_import_mappings;

CREATE POLICY "supplier_import_mappings_select_owner_or_admin"
ON public.supplier_import_mappings
FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "supplier_import_mappings_insert_owner_or_admin"
ON public.supplier_import_mappings
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "supplier_import_mappings_update_owner_or_admin"
ON public.supplier_import_mappings
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "supplier_import_mappings_delete_owner_or_admin"
ON public.supplier_import_mappings
FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
