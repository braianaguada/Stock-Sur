import { supabase } from "@/integrations/supabase/client";
import { LOCAL_MAPPING_PREFIX } from "@/features/suppliers/constants";
import type { CatalogImportLine, SupplierCatalogLinePayload } from "@/features/suppliers/types";

export function getLocalSupplierImportMappingKey(supplierId: string, fileType: "xlsx" | "pdf") {
  return `${LOCAL_MAPPING_PREFIX}:${supplierId}:${fileType}`;
}

export async function loadStoredSupplierImportMapping<T>(
  companyId: string,
  supplierId: string,
  fileType: "xlsx" | "pdf",
): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from("supplier_import_mappings")
      .select("mapping")
      .eq("company_id", companyId)
      .eq("supplier_id", supplierId)
      .eq("file_type", fileType)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.mapping as T | undefined) ?? null;
  } catch {
    const cached = localStorage.getItem(getLocalSupplierImportMappingKey(supplierId, fileType));
    if (!cached) return null;
    try {
      return JSON.parse(cached) as T;
    } catch {
      return null;
    }
  }
}

export async function saveStoredSupplierImportMapping<T>(
  companyId: string,
  supplierId: string,
  fileType: "xlsx" | "pdf",
  mapping: T,
) {
  localStorage.setItem(getLocalSupplierImportMappingKey(supplierId, fileType), JSON.stringify(mapping));
  const { error } = await supabase
    .from("supplier_import_mappings")
    .upsert(
      {
        company_id: companyId,
        supplier_id: supplierId,
        file_type: fileType,
        mapping,
      },
      { onConflict: "supplier_id,file_type" },
    );
  if (error) throw error;
}

export function toSupplierCatalogRpcLinePayload(line: CatalogImportLine): SupplierCatalogLinePayload {
  return {
    supplier_code: line.supplier_code,
    raw_description: line.raw_description,
    normalized_description: line.normalized_description,
    cost: line.cost,
    currency: line.currency || "ARS",
    row_index: line.row_index,
    matched_item_id: null,
    match_status: "PENDING",
  };
}
