import { supabase } from "@/integrations/supabase/client";
import type { SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";

export interface SupplierComparisonVersionOption {
  id: string;
  supplierId: string;
  supplierName: string;
  listName: string;
  importedAt: string;
}

export async function fetchSupplierComparisonVersions(companyId: string): Promise<SupplierComparisonVersionOption[]> {
  const [{ data: suppliers, error: suppliersError }, { data: catalogs, error: catalogsError }, { data: versions, error: versionsError }] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("company_id", companyId).eq("is_active", true),
    supabase.from("supplier_catalogs").select("id, supplier_id, title").eq("company_id", companyId).eq("status", "ACTIVE"),
    supabase.from("supplier_catalog_versions").select("id, catalog_id, supplier_id, title, imported_at").eq("company_id", companyId).order("imported_at", { ascending: false }),
  ]);
  if (suppliersError) throw suppliersError;
  if (catalogsError) throw catalogsError;
  if (versionsError) throw versionsError;

  const supplierNames = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.name]));
  const catalogById = new Map((catalogs ?? []).map((catalog) => [catalog.id, catalog]));
  return (versions ?? []).flatMap((version) => {
    const catalog = catalogById.get(version.catalog_id);
    const supplierName = supplierNames.get(version.supplier_id);
    if (!catalog || !supplierName || catalog.supplier_id !== version.supplier_id) return [];
    return [{
      id: version.id,
      supplierId: version.supplier_id,
      supplierName,
      listName: version.title?.trim() || catalog.title,
      importedAt: version.imported_at,
    }];
  });
}

export async function fetchSupplierComparisonOffers(
  companyId: string,
  selectedVersions: SupplierComparisonVersionOption[],
): Promise<SupplierComparisonOffer[]> {
  if (selectedVersions.length === 0) return [];
  const versionById = new Map(selectedVersions.map((version) => [version.id, version]));
  const versionIds = selectedVersions.map((version) => version.id);
  const pageSize = 1000;
  const rows: Array<{
    id: string; supplier_catalog_version_id: string; supplier_code: string | null; raw_description: string;
    normalized_description: string | null; matched_item_id: string | null; cost: number; currency: string;
  }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("supplier_catalog_lines")
      .select("id, supplier_catalog_version_id, supplier_code, raw_description, normalized_description, matched_item_id, cost, currency")
      .eq("company_id", companyId)
      .in("supplier_catalog_version_id", versionIds)
      .order("row_index", { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  return rows.flatMap((row) => {
    const version = versionById.get(row.supplier_catalog_version_id);
    if (!version || (row.currency !== "ARS" && row.currency !== "USD")) return [];
    return [{
      id: row.id,
      versionId: row.supplier_catalog_version_id,
      supplierId: version.supplierId,
      supplierName: version.supplierName,
      listName: version.listName,
      description: row.raw_description,
      normalizedDescription: row.normalized_description,
      supplierCode: row.supplier_code,
      matchedItemId: row.matched_item_id,
      cost: Number(row.cost),
      currency: row.currency,
    } satisfies SupplierComparisonOffer];
  });
}

