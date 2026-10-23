import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { MAX_IMPORT_ROWS, type ImportCurrency, type SupplierPreviewRow } from "./excelImport";

export async function saveSupplierExcel(params: {
  companyId: string;
  supplierId: string;
  title: string;
  fileName: string;
  catalogId: string | null;
  currency: ImportCurrency;
  rows: SupplierPreviewRow[];
}): Promise<string> {
  if (!params.companyId || !params.supplierId || !params.title.trim()) throw new Error("Indicá proveedor, empresa y nombre de la lista.");
  if (!params.rows.length || params.rows.length > MAX_IMPORT_ROWS || params.rows.some((row) => row.errors.length || !row.name.trim() || row.price === null || !Number.isFinite(row.price) || row.price <= 0)) {
    throw new Error("Revisá las filas inválidas antes de importar.");
  }
  // Bind the supplier to the current company as well as the server-side permission checks in the atomic RPC.
  const { data: supplier, error: supplierError } = await supabase.from("suppliers")
    .select("id").eq("company_id", params.companyId).eq("id", params.supplierId).eq("is_active", true).maybeSingle();
  if (supplierError) throw supplierError;
  if (!supplier) throw new Error("El proveedor no pertenece a la empresa activa o está inactivo.");
  const lines = params.rows.map((row) => ({
    raw_description: row.name,
    normalized_description: row.name.toLocaleLowerCase("es-AR"),
    product_name: row.name,
    presentation_raw: row.unit,
    cost: row.price,
    currency: params.currency,
    tax_treatment: "EXCLUDED",
    row_index: row.row,
    matched_item_id: null,
    match_status: "PENDING",
  }));
  const { data, error } = await supabase.rpc("create_supplier_catalog_import_atomic", {
    p_supplier_id: params.supplierId,
    p_document_title: params.title.trim(),
    p_file_name: params.fileName,
    p_file_type: "xlsx",
    p_catalog_id: params.catalogId,
    p_catalog_title: params.title.trim(),
    p_version_title: params.title.trim(),
    p_lines: lines as Json,
  });
  if (error) throw error;
  const result = data as { version_id?: string; inserted_count?: number } | null;
  if (!result?.version_id || result.inserted_count !== lines.length) throw new Error("No se pudo verificar el resultado. Revisá el historial antes de volver a importar.");
  return result.version_id;
}
