CREATE OR REPLACE FUNCTION public.create_supplier_catalog_import(
  p_supplier_id UUID,
  p_supplier_document_id UUID,
  p_catalog_id UUID DEFAULT NULL,
  p_catalog_title TEXT DEFAULT NULL,
  p_catalog_notes TEXT DEFAULT NULL,
  p_version_title TEXT DEFAULT NULL,
  p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_catalog_id UUID;
  v_version_id UUID;
  v_inserted_count INTEGER := 0;
  v_is_admin BOOLEAN := public.has_role(v_uid, 'admin');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.supplier_documents d
    WHERE d.id = p_supplier_document_id
      AND d.supplier_id = p_supplier_id
      AND (v_is_admin OR d.created_by = v_uid)
  ) THEN
    RAISE EXCEPTION 'No autorizado para usar el documento indicado';
  END IF;

  IF p_catalog_id IS NOT NULL THEN
    SELECT c.id
      INTO v_catalog_id
    FROM public.supplier_catalogs c
    WHERE c.id = p_catalog_id
      AND c.supplier_id = p_supplier_id
      AND (v_is_admin OR c.created_by = v_uid)
    LIMIT 1;

    IF v_catalog_id IS NULL THEN
      RAISE EXCEPTION 'No autorizado para usar el catálogo indicado';
    END IF;
  ELSE
    INSERT INTO public.supplier_catalogs (supplier_id, title, notes, created_by)
    VALUES (
      p_supplier_id,
      COALESCE(NULLIF(TRIM(p_catalog_title), ''), 'Listado sin título'),
      NULLIF(TRIM(p_catalog_notes), ''),
      v_uid
    )
    RETURNING id INTO v_catalog_id;
  END IF;

  INSERT INTO public.supplier_catalog_versions (
    supplier_id,
    catalog_id,
    supplier_document_id,
    title,
    created_by
  )
  VALUES (
    p_supplier_id,
    v_catalog_id,
    p_supplier_document_id,
    NULLIF(TRIM(p_version_title), ''),
    v_uid
  )
  RETURNING id INTO v_version_id;

  IF jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
    INSERT INTO public.supplier_catalog_lines (
      supplier_catalog_version_id,
      supplier_code,
      raw_description,
      normalized_description,
      cost,
      currency,
      row_index,
      matched_item_id,
      match_status,
      created_by
    )
    SELECT
      v_version_id,
      NULLIF(TRIM(x.supplier_code), ''),
      TRIM(x.raw_description),
      NULLIF(TRIM(x.normalized_description), ''),
      x.cost,
      COALESCE(NULLIF(UPPER(TRIM(x.currency)), ''), 'ARS'),
      x.row_index,
      x.matched_item_id,
      COALESCE(x.match_status, 'PENDING'::public.match_status),
      v_uid
    FROM jsonb_to_recordset(p_lines) AS x(
      supplier_code TEXT,
      raw_description TEXT,
      normalized_description TEXT,
      cost NUMERIC,
      currency TEXT,
      row_index INTEGER,
      matched_item_id UUID,
      match_status public.match_status
    )
    WHERE NULLIF(TRIM(x.raw_description), '') IS NOT NULL
      AND x.cost IS NOT NULL
      AND x.cost > 0;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'catalog_id', v_catalog_id,
    'version_id', v_version_id,
    'inserted_count', v_inserted_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_supplier_catalog_import(UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_supplier_catalog_import(UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
