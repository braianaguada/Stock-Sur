import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogLine,
  Supplier,
  SupplierCatalog,
  SupplierCatalogVersion,
} from "@/features/suppliers/types";

export async function fetchSuppliers(params: {
  companyId: string;
  statusFilter: "active" | "inactive" | "all";
  search: string;
}) {
  let query = supabase.from("suppliers").select("*").eq("company_id", params.companyId).order("name");
  if (params.statusFilter === "active") query = query.eq("is_active", true);
  if (params.statusFilter === "inactive") query = query.eq("is_active", false);
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%,contact_name.ilike.%${params.search}%`);
  }
  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function fetchSupplierCatalogs(companyId: string, supplierId: string) {
  const { data, error } = await supabase
    .from("supplier_catalogs")
    .select("id, title, created_at")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierCatalog[];
}

export async function fetchSupplierCatalogVersions(companyId: string, supplierId: string) {
  const { data, error } = await supabase
    .from("supplier_catalog_versions")
    .select("id, catalog_id, title, imported_at, supplier_document_id")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId)
    .order("imported_at", { ascending: false });
  if (error) throw error;

  const versions = (data ?? []) as Array<{
    id: string;
    catalog_id: string;
    title: string | null;
    imported_at: string;
    supplier_document_id: string;
  }>;

  if (versions.length === 0) return [];

  const { data: docs, error: docsError } = await supabase
    .from("supplier_documents")
    .select("id, file_name, file_type")
    .eq("company_id", companyId)
    .eq("supplier_id", supplierId);
  if (docsError) throw docsError;
  const docsById = new Map((docs ?? []).map((doc) => [doc.id, doc]));

  const { data: lineCounts, error: lineCountError } = await supabase
    .from("supplier_catalog_lines")
    .select("supplier_catalog_version_id")
    .in("supplier_catalog_version_id", versions.map((version) => version.id));
  if (lineCountError) throw lineCountError;

  const countMap = (lineCounts ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.supplier_catalog_version_id] = (acc[row.supplier_catalog_version_id] ?? 0) + 1;
    return acc;
  }, {});

  return versions.map((version) => {
    const doc = docsById.get(version.supplier_document_id);
    return {
      ...version,
      file_name: doc?.file_name ?? "archivo",
      file_type: doc?.file_type ?? "-",
      line_count: countMap[version.id] ?? 0,
    };
  }) as SupplierCatalogVersion[];
}

export async function fetchSupplierCatalogLines(params: {
  companyId: string;
  versionId: string;
  search: string;
}) {
  let query = supabase
    .from("supplier_catalog_lines")
    .select("id, supplier_code, raw_description, cost, currency")
    .eq("company_id", params.companyId)
    .eq("supplier_catalog_version_id", params.versionId)
    .order("row_index", { ascending: true, nullsFirst: false })
    .limit(250);

  if (params.search) {
    query = query.or(`raw_description.ilike.%${params.search}%,supplier_code.ilike.%${params.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CatalogLine[];
}
