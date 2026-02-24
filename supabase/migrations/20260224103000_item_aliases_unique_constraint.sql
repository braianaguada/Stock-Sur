DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_aliases_item_id_alias_key'
      AND conrelid = 'public.item_aliases'::regclass
  ) THEN
    ALTER TABLE public.item_aliases
      ADD CONSTRAINT item_aliases_item_id_alias_key UNIQUE (item_id, alias);
  END IF;
END
$$;
