import { describe, expect, it } from "vitest";
import { buildSupplierComparisonGroups, groupComparisonSelectionBySupplier, normalizeComparisonDescription, normalizeComparisonSearch, type SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";

const offer = (overrides: Partial<SupplierComparisonOffer> & Pick<SupplierComparisonOffer, "id" | "cost" | "currency">): SupplierComparisonOffer => ({
  versionId: "version-1", supplierId: "supplier-1", supplierName: "Proveedor", listName: "Lista",
  description: "Compresor Embraco 1/3 R134", normalizedDescription: null, supplierCode: null, matchedItemId: null,
  taxTreatment: "INCLUDED",
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

  it("normaliza la búsqueda antes de enviarla al filtro de base", () => {
    expect(normalizeComparisonSearch("  Caño 1/2, frío  ")).toBe("CANO 1 2 FRIO");
    expect(normalizeComparisonSearch("a")).toBe("A");
  });

  it("agrupa la bandeja por proveedor y totaliza cada moneda sin convertir", () => {
    const groups = groupComparisonSelectionBySupplier([
      offer({ id: "a", supplierId: "supplier-a", supplierName: "Proveedor A", cost: 100, currency: "ARS" }),
      offer({ id: "b", supplierId: "supplier-a", supplierName: "Proveedor A", cost: 25, currency: "ARS" }),
      offer({ id: "c", supplierId: "supplier-b", supplierName: "Proveedor B", cost: 2, currency: "USD" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].totals).toEqual({ ARS: 125 });
    expect(groups[1].totals).toEqual({ USD: 2 });
  });

  it("no considera fiscalmente comparables ofertas con IVA desconocido o diferente", () => {
    const [unknown] = buildSupplierComparisonGroups([
      offer({ id: "a", cost: 100, currency: "ARS", taxTreatment: "UNKNOWN" }),
    ]);
    const [mixed] = buildSupplierComparisonGroups([
      offer({ id: "a", cost: 100, currency: "ARS", taxTreatment: "INCLUDED" }),
      offer({ id: "b", cost: 90, currency: "ARS", taxTreatment: "EXCLUDED" }),
    ]);
    expect(unknown.taxComparable).toBe(false);
    expect(mixed.taxComparable).toBe(false);
  });
});
