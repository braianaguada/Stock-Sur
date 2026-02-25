-- Runtime fixes: suppliers.whatsapp, optional supplier_id in price_lists,
-- and bridge table public.price_list_items.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'phone'
  ) THEN
    EXECUTE $q$
      UPDATE public.suppliers
      SET whatsapp = phone
      WHERE COALESCE(NULLIF(BTRIM(whatsapp), ''), '') = ''
        AND COALESCE(NULLIF(BTRIM(phone), ''), '') <> ''
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'telefono'
  ) THEN
    EXECUTE $q$
      UPDATE public.suppliers
      SET whatsapp = telefono
      WHERE COALESCE(NULLIF(BTRIM(whatsapp), ''), '') = ''
        AND COALESCE(NULLIF(BTRIM(telefono), ''), '') <> ''
    $q$;
  END IF;
END
$$;

ALTER TABLE public.price_lists
  ALTER COLUMN supplier_id DROP NOT NULL;

DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = cols.attnum
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'price_lists'
      AND att.attname = 'supplier_id'
  LOOP
    EXECUTE format('ALTER TABLE public.price_lists DROP CONSTRAINT IF EXISTS %I', fk.conname);
  END LOOP;

  ALTER TABLE public.price_lists
    ADD CONSTRAINT price_lists_supplier_id_fkey
    FOREIGN KEY (supplier_id)
    REFERENCES public.suppliers(id)
    ON DELETE SET NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.price_list_items (
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  price_override NUMERIC NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  PRIMARY KEY (price_list_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_price_list_items_item_id
  ON public.price_list_items(item_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_price_list_id
  ON public.price_list_items(price_list_id);

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_list_items_read_authenticated" ON public.price_list_items;
DROP POLICY IF EXISTS "price_list_items_insert_owner_or_admin" ON public.price_list_items;
DROP POLICY IF EXISTS "price_list_items_update_owner_or_admin" ON public.price_list_items;
DROP POLICY IF EXISTS "price_list_items_delete_owner_or_admin" ON public.price_list_items;
DROP POLICY IF EXISTS "Authenticated can manage price_list_items" ON public.price_list_items;

CREATE POLICY "price_list_items_read_authenticated"
ON public.price_list_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "price_list_items_insert_owner_or_admin"
ON public.price_list_items
FOR INSERT
TO authenticated
WITH CHECK (
  created_by IS NULL
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "price_list_items_update_owner_or_admin"
ON public.price_list_items
FOR UPDATE
TO authenticated
USING (
  created_by IS NULL
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  created_by IS NULL
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "price_list_items_delete_owner_or_admin"
ON public.price_list_items
FOR DELETE
TO authenticated
USING (
  created_by IS NULL
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

NOTIFY pgrst, 'reload schema';
