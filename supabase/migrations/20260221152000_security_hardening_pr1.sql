-- PR1: Security hardening
-- 1) New users must default to 'user', never 'admin'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

-- 2) Ownership columns for write authorization.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.item_aliases ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.price_list_versions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.price_list_lines ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.quote_lines ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.items ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.item_aliases ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.suppliers ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.price_lists ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.price_list_versions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.price_list_lines ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.customers ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.quote_lines ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.stock_movements ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.quotes ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Backfill current rows so current data remains writable by current owners.
UPDATE public.items SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.item_aliases SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.suppliers SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.price_lists SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.price_list_versions SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.price_list_lines SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.customers SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.quote_lines SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.stock_movements SET created_by = auth.uid() WHERE created_by IS NULL;
UPDATE public.quotes SET created_by = auth.uid() WHERE created_by IS NULL;

-- 3) Replace permissive RLS policies with read-for-authenticated and write-for-owner-or-admin.
DROP POLICY IF EXISTS "Authenticated can view items" ON public.items;
DROP POLICY IF EXISTS "Authenticated can insert items" ON public.items;
DROP POLICY IF EXISTS "Authenticated can update items" ON public.items;
DROP POLICY IF EXISTS "Authenticated can delete items" ON public.items;
CREATE POLICY "items_read_authenticated" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_insert_owner_or_admin" ON public.items FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "items_update_owner_or_admin" ON public.items FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "items_delete_owner_or_admin" ON public.items FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage aliases" ON public.item_aliases;
CREATE POLICY "item_aliases_read_authenticated" ON public.item_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "item_aliases_insert_owner_or_admin" ON public.item_aliases FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "item_aliases_update_owner_or_admin" ON public.item_aliases FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "item_aliases_delete_owner_or_admin" ON public.item_aliases FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage stock" ON public.stock_movements;
CREATE POLICY "stock_movements_read_authenticated" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_movements_insert_owner_or_admin" ON public.stock_movements FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stock_movements_update_owner_or_admin" ON public.stock_movements FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stock_movements_delete_owner_or_admin" ON public.stock_movements FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage suppliers" ON public.suppliers;
CREATE POLICY "suppliers_read_authenticated" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_insert_owner_or_admin" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "suppliers_update_owner_or_admin" ON public.suppliers FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "suppliers_delete_owner_or_admin" ON public.suppliers FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage price_lists" ON public.price_lists;
CREATE POLICY "price_lists_read_authenticated" ON public.price_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_lists_insert_owner_or_admin" ON public.price_lists FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_lists_update_owner_or_admin" ON public.price_lists FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_lists_delete_owner_or_admin" ON public.price_lists FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage plv" ON public.price_list_versions;
CREATE POLICY "price_list_versions_read_authenticated" ON public.price_list_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_list_versions_insert_owner_or_admin" ON public.price_list_versions FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_list_versions_update_owner_or_admin" ON public.price_list_versions FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_list_versions_delete_owner_or_admin" ON public.price_list_versions FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage pll" ON public.price_list_lines;
CREATE POLICY "price_list_lines_read_authenticated" ON public.price_list_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_list_lines_insert_owner_or_admin" ON public.price_list_lines FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_list_lines_update_owner_or_admin" ON public.price_list_lines FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "price_list_lines_delete_owner_or_admin" ON public.price_list_lines FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage customers" ON public.customers;
CREATE POLICY "customers_read_authenticated" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_owner_or_admin" ON public.customers FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "customers_update_owner_or_admin" ON public.customers FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "customers_delete_owner_or_admin" ON public.customers FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage quotes" ON public.quotes;
CREATE POLICY "quotes_read_authenticated" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotes_insert_owner_or_admin" ON public.quotes FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quotes_update_owner_or_admin" ON public.quotes FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quotes_delete_owner_or_admin" ON public.quotes FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can manage quote_lines" ON public.quote_lines;
CREATE POLICY "quote_lines_read_authenticated" ON public.quote_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "quote_lines_insert_owner_or_admin" ON public.quote_lines FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quote_lines_update_owner_or_admin" ON public.quote_lines FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "quote_lines_delete_owner_or_admin" ON public.quote_lines FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
