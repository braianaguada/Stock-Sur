import { describe, expect, it } from "vitest";
import { buildSupplierComparisonGroups, normalizeComparisonDescription, type SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";

const offer = (overrides: Partial<SupplierComparisonOffer> & Pick<SupplierComparisonOffer, "id" | "cost" | "currency">): SupplierComparisonOffer => ({
  versionId: "version-1", supplierId: "supplier-1", supplierName: "Proveedor", listName: "Lista",
  description: "Compresor Embraco 1/3 R134", normalizedDescription: null, supplierCode: null, matchedItemId: null,
  ...overrides,
});

describe("supplier comparison domain", () => {
  it("normaliza de forma estable pero solo agrupa coincidencias exactas", () => {
    expect(normalizeComparisonDescription("  Caño cobre, 1/2 ” ")).toBe("CANO COBRE 1 2");
    const groups = buildSupplierComparisonGroups([
      offer({ id: "a", cost: 100, currency: "USD", description: "Compresor Émbraco" }),
      offer({ id: "b", cost: 90, currency: "USD", description: "COMPRESOR EMBRACO" }),
      offer({ id: "c", cost: 80, currency: "USD", description: "Compresor Embraco 1/3" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.offers.length === 2)?.matchKind).toBe("NORMALIZED_EXACT");
  });

  it("prioriza matched_item_id sin fingir similitud textual", () => {
    const groups = buildSupplierComparisonGroups([
      offer({ id: "a", cost: 100, currency: "ARS", description: "Texto A", matchedItemId: "item-1" }),
      offer({ id: "b", cost: 120, currency: "ARS", description: "Texto B", matchedItemId: "item-1" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].matchKind).toBe("MATCHED_ITEM");
  });

  it("calcula ranking y diferencia por moneda sin FX", () => {
    const [group] = buildSupplierComparisonGroups([
      offer({ id: "ars-low", cost: 100, currency: "ARS" }),
      offer({ id: "ars-high", cost: 125, currency: "ARS" }),
      offer({ id: "usd", cost: 1, currency: "USD" }),
    ]);
    expect(group.offers.find((row) => row.id === "ars-low")?.rank).toBe(1);
    expect(group.offers.find((row) => row.id === "ars-high")?.differencePercent).toBe(25);
    expect(group.offers.find((row) => row.id === "usd")?.rank).toBe(1);
    expect(group.offers.find((row) => row.id === "usd")?.arsReference).toBeNull();
  });

  it("agrega una referencia ARS con FX sin alterar precio ni ranking original", () => {
    const [group] = buildSupplierComparisonGroups([
      offer({ id: "ars", cost: 1500, currency: "ARS" }),
      offer({ id: "usd", cost: 1, currency: "USD" }),
    ], 1400);
    const usd = group.offers.find((row) => row.id === "usd");
    expect(usd?.cost).toBe(1);
    expect(usd?.arsReference).toBe(1400);
    expect(usd?.rank).toBe(1);
    expect(usd?.referenceRank).toBe(1);
    expect(group.offers.find((row) => row.id === "ars")?.referenceDifferencePercent).toBeCloseTo(7.1428, 3);
  });
});
