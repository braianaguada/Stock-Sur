import { supabase } from "@/integrations/supabase/client";
import { normalizeComparisonSearch, type SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";
import type { TaxTreatment } from "@/lib/importers/catalogImporter";

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
  search: string,
): Promise<SupplierComparisonOffer[]> {
  const normalizedSearch = normalizeComparisonSearch(search);
  if (selectedVersions.length === 0 || normalizedSearch.length < 2) return [];
  const versionById = new Map(selectedVersions.map((version) => [version.id, version]));
  const versionIds = selectedVersions.map((version) => version.id);
  const rows: Array<{
    id: string; supplier_catalog_version_id: string; supplier_code: string | null; raw_description: string;
    normalized_description: string | null; product_name: string | null; matched_item_id: string | null;
    cost: number; currency: string; tax_treatment: string;
  }> = [];
  const terms = normalizedSearch.split(" ").filter((term) => term.length >= 2).slice(0, 6);
  const patterns = [...new Set([normalizedSearch, ...terms])];
  const orFilter = patterns.flatMap((term) => [
    `raw_description.ilike.%${term}%`,
    `normalized_description.ilike.%${term}%`,
    `supplier_code.ilike.%${term}%`,
    `product_name.ilike.%${term}%`,
  ]).join(",");
  const { data, error } = await supabase
    .from("supplier_catalog_lines")
    .select("id, supplier_catalog_version_id, supplier_code, raw_description, normalized_description, product_name, matched_item_id, cost, currency, tax_treatment")
    .eq("company_id", companyId)
    .in("supplier_catalog_version_id", versionIds)
    .or(orFilter)
    .order("row_index", { ascending: true, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  rows.push(...(data ?? []));

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
      taxTreatment: (["INCLUDED", "EXCLUDED", "UNKNOWN"].includes(row.tax_treatment)
        ? row.tax_treatment
        : "UNKNOWN") as TaxTreatment,
    } satisfies SupplierComparisonOffer];
  });
}

