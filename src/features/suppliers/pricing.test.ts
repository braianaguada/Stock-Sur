import { describe, expect, it } from "vitest";
import { addSupplierCartItem, convertSupplierPrice, supplierOrderAmounts, supplierPriceBreakdown, type SupplierCartItem } from "./pricing";
import type { CatalogLine, Supplier } from "./types";

const supplier = { vat_rate: 21, freight_rate: 5 } as Supplier;
const line: CatalogLine = { id: "p1", supplier_code: null, raw_description: "Cable", cost: 100, currency: "USD", tax_treatment: "EXCLUDED" };

describe("supplier pricing and cart", () => {
  it("converts in both directions without requiring FX for the original currency", () => {
    expect(convertSupplierPrice(2, "USD", "ARS", 1200)).toBe(2400);
    expect(convertSupplierPrice(2400, "ARS", "USD", 1200)).toBe(2);
    expect(convertSupplierPrice(100, "USD", "USD")).toBe(100);
    for (const rate of [undefined, 0, -1, Infinity, NaN]) expect(convertSupplierPrice(100, "USD", "ARS", rate)).toBeNull();
  });
  it("adds VAT and freight separately over net and preserves the source price", () => {
    expect(supplierPriceBreakdown(line, supplier, "ARS", 1000)).toEqual({ net: 100000, vat: 21000, freight: 5000, taxed: 121000, total: 126000 });
    expect(line.cost).toBe(100);
    expect(supplierPriceBreakdown(line, supplier, "ARS")).toBeNull();
    expect(supplierPriceBreakdown({ ...line, tax_treatment: "UNKNOWN" }, supplier, "USD")).toBeNull();
  });
  it("extracts included VAT before applying freight", () => {
    const price = supplierPriceBreakdown({ ...line, cost: 121, tax_treatment: "INCLUDED" }, supplier, "USD");
    expect(price?.net).toBeCloseTo(100);
    expect(price?.total).toBeCloseTo(126);
    expect(supplierPriceBreakdown(line, {} as Supplier, "USD")?.total).toBe(121);
  });
  it("combines repeated products while keeping different lists and suppliers", () => {
    const item: SupplierCartItem = { supplierId: "s1", versionId: "v1", listName: "Lista", line, quantity: 2 };
    const added = addSupplierCartItem([item], { ...item, quantity: 3 });
    expect(added[0].quantity).toBe(5);
    expect(item.quantity).toBe(2);
    const mixed = addSupplierCartItem(added, { ...item, versionId: "v2", line: { ...line, id: "p2" } });
    expect(mixed).toHaveLength(2);
    expect(addSupplierCartItem(mixed, { ...item, supplierId: "s2" })).toHaveLength(3);
  });
  it("keeps legacy totals unchanged and applies saved charges to new orders", () => {
    expect(supplierOrderAmounts(100).total).toBe(100);
    expect(supplierOrderAmounts(100, 21, 5)).toEqual({ net: 100, vat: 21, freight: 5, total: 126 });
  });
});
