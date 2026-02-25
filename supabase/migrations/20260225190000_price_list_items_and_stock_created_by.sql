ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

ALTER TABLE public.price_lists
  ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE public.price_lists
  DROP CONSTRAINT IF EXISTS price_lists_supplier_id_fkey;

ALTER TABLE public.price_lists
  ADD CONSTRAINT price_lists_supplier_id_fkey
  FOREIGN KEY (supplier_id)
  REFERENCES public.suppliers(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.price_list_items (
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  price_override NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  PRIMARY KEY (price_list_id, item_id)
);

ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can manage price_list_items" ON public.price_list_items;
CREATE POLICY "Authenticated can manage price_list_items"
ON public.price_list_items FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.stock_movements
  ALTER COLUMN created_by SET DEFAULT auth.uid();
