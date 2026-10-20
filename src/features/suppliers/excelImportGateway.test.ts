import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveSupplierExcel } from "./excelImportGateway";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(), supplier: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    const query = { select: () => query, eq: (key: string, value: unknown) => { mocks.eq(key, value); return query; }, maybeSingle: mocks.supplier };
    return query;
  }, rpc: mocks.rpc,
} }));

const params = {
  companyId: "company-a", supplierId: "supplier-a", title: " Octubre ", fileName: "lista.xlsx",
  catalogId: null, currency: "USD" as const,
  rows: [{ row: 2, name: "Cable", unit: "metro", priceText: "12.5", price: 12.5, errors: [] }],
};

describe("supplier Excel atomic save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supplier.mockResolvedValue({ data: { id: "supplier-a" }, error: null });
    mocks.rpc.mockResolvedValue({ data: { version_id: "version-a", inserted_count: 1 }, error: null });
  });
  it("checks company and active supplier and persists the exact net price and chosen unit in one RPC", async () => {
    expect(await saveSupplierExcel(params)).toBe("version-a");
    expect(mocks.eq.mock.calls).toEqual([["company_id", "company-a"], ["id", "supplier-a"], ["is_active", true]]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("create_supplier_catalog_import_atomic", expect.objectContaining({
      p_catalog_id: null, p_version_title: "Octubre",
      p_lines: [expect.objectContaining({ product_name: "Cable", presentation_raw: "metro", cost: 12.5, currency: "USD", tax_treatment: "EXCLUDED", row_index: 2, matched_item_id: null })],
    }));
  });
  it("cannot import into a supplier unavailable in the current company", async () => {
    mocks.supplier.mockResolvedValue({ data: null, error: null });
    await expect(saveSupplierExcel(params)).rejects.toThrow(/empresa activa/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never sends partial valid rows when another selected row is invalid", async () => {
    await expect(saveSupplierExcel({ ...params, rows: [...params.rows, { ...params.rows[0], price: null, errors: ["Precio inválido"] }] })).rejects.toThrow(/filas inválidas/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("checks the server result before reporting a completed import", async () => {
    mocks.rpc.mockResolvedValue({ data: { version_id: "version-a", inserted_count: 0 }, error: null });
    await expect(saveSupplierExcel(params)).rejects.toThrow(/historial/);
  });
});
