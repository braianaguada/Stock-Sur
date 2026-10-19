import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogPageKey, fetchCatalogPage, type CatalogPageFilters } from "./catalog-page";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const filters: CatalogPageFilters = {
  search: "caño media", status: "active", category: "all", supplier: "all",
  stock: "in_stock", sort: "stock", direction: "desc", page: 121, pageSize: 10,
};
beforeEach(() => rpc.mockReset());
describe("server catalog pages", () => {
  it("passes the company, search, stock and page to the database without local truncation", async () => {
    const payload = { items: [{ id: "last-item", stock: 3 }], total: 1201, page: 121 };
    rpc.mockResolvedValue({ data: payload, error: null });
    expect(await fetchCatalogPage("company-a", filters)).toBe(payload);
    expect(rpc).toHaveBeenCalledWith("list_items_page", {
      p_company_id: "company-a", p_search: "caño media", p_status: "active",
      p_category: "all", p_supplier: "all", p_stock: "in_stock", p_sort: "stock",
      p_direction: "desc", p_page: 121, p_page_size: 10,
    });
  });
  it("isolates companies, pages and searches in the cache", () => {
    const key = catalogPageKey("company-a", filters);
    expect(key).not.toEqual(catalogPageKey("company-b", filters));
    expect(key).not.toEqual(catalogPageKey("company-a", { ...filters, page: 1 }));
    expect(key).not.toEqual(catalogPageKey("company-a", { ...filters, search: "otro" }));
  });
  it("exposes the database error for an actionable retry", async () => {
    const error = new Error("Sin acceso al catálogo de esta empresa");
    rpc.mockResolvedValue({ data: null, error });
    await expect(fetchCatalogPage("company-a", filters)).rejects.toBe(error);
  });
});
