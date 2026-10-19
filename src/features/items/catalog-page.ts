import { supabase } from "@/integrations/supabase/client";
import type { Item } from "./types";

export type CatalogPageItem = Item & {
  stock: number;
  base_cost: number | null;
  main_price_original: number | null;
  main_price_list_name: string | null;
};
export type CatalogPage = {
  items: CatalogPageItem[];
  total: number;
  page: number;
  stats: { total: number; active: number; inStock: number; noStock: number };
  categories: string[];
  suppliers: string[];
};
export type CatalogPageFilters = {
  search: string; status: "active" | "inactive" | "all"; category: string; supplier: string;
  stock: "all" | "in_stock" | "no_stock"; sort: string; direction: "asc" | "desc";
  page: number; pageSize: number;
};
export const catalogPageKey = (companyId: string | null, filters: CatalogPageFilters) =>
  ["items-catalog", companyId ?? "no-company", "page", filters] as const;

export async function fetchCatalogPage(companyId: string, filters: CatalogPageFilters): Promise<CatalogPage> {
  const { data, error } = await supabase.rpc("list_items_page", {
    p_company_id: companyId, p_search: filters.search, p_status: filters.status,
    p_category: filters.category, p_supplier: filters.supplier, p_stock: filters.stock,
    p_sort: filters.sort, p_direction: filters.direction, p_page: filters.page, p_page_size: filters.pageSize,
  });
  if (error) throw error;
  return data as unknown as CatalogPage;
}
