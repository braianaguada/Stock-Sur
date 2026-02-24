DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_reason') THEN
    CREATE TYPE public.match_reason AS ENUM ('SUPPLIER_CODE', 'ALIAS_TOKEN', 'ALIAS_CONTAINS', 'NONE');
  END IF;
END $$;

ALTER TABLE public.price_list_lines
ADD COLUMN IF NOT EXISTS match_reason public.match_reason NOT NULL DEFAULT 'NONE';
