import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSupplierCatalogLines, fetchSupplierCatalogVersions } from "./queries";

const mocks = vi.hoisted(() => ({ filters: [] as unknown[][], ranges: [] as number[][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { mocks.filters.push([key, value]); return query; },
    in: () => query, order: () => query,
    range: async (from: number, to: number) => {
      mocks.ranges.push([from, to]);
      return { error: null, data: Array.from({ length: 1205 }, (_, i) => ({
        id: `line-${i}`, raw_description: `Producto ${i}`, supplier_catalog_version_id: "version-a",
      })).slice(from, to + 1) };
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null, data: table === "supplier_catalog_versions"
      ? [{ id: "version-a", catalog_id: "catalog-a", imported_at: "2026-10-20", supplier_document_id: "document-a" }]
      : [{ id: "document-a", file_name: "lista.xlsx", file_type: "xlsx" }] }).then(resolve),
  };
  return query;
} } }));

describe("complete supplier catalog reads", () => {
  beforeEach(() => { mocks.filters.length = 0; mocks.ranges.length = 0; });
  it("can find a product beyond the old 250-row and server 1000-row limits", async () => {
    const lines = await fetchSupplierCatalogLines({ companyId: "company-a", versionId: "version-a", search: "Producto 1204" });
    expect(lines.map((line) => line.id)).toEqual(["line-1204"]);
    expect(mocks.ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(mocks.filters).toContainEqual(["company_id", "company-a"]);
    expect(mocks.filters).toContainEqual(["supplier_catalog_version_id", "version-a"]);
  });
  it("counts all imported rows in version history", async () => {
    const versions = await fetchSupplierCatalogVersions("company-a", "supplier-a");
    expect(versions[0].line_count).toBe(1205);
    expect(mocks.ranges).toEqual([[0, 999], [1000, 1999]]);
  });
});
