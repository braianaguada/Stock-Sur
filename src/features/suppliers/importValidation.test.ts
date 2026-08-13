import { describe, expect, it } from "vitest";
import { validateSupplierImportLines } from "@/features/suppliers/importValidation";
import type { ExtractionReviewLine } from "@/features/suppliers/types";

const line = (overrides: Partial<ExtractionReviewLine> = {}): ExtractionReviewLine => ({
  id: "line-1",
  supplier_code: "ABC",
  raw_description: "Ruleman",
  cost: 100,
  currency: "ARS",
  tax_treatment: "UNKNOWN",
  row_index: 1,
  ...overrides,
});

describe("validateSupplierImportLines", () => {
  it("accepts valid reviewed lines", () => {
    const result = validateSupplierImportLines([line()]);
    expect(result.canImport).toBe(true);
    expect(result.invalidLineIds.size).toBe(0);
  });

  it("blocks invalid prices, empty descriptions and unresolved currencies", () => {
    const result = validateSupplierImportLines([
      line({ id: "empty", product_name: " ", raw_description: " " }),
      line({ id: "price", cost: 0 }),
      line({
        id: "currency",
        currency_detection: { currency: "ARS", source: "DEFAULT_ARS", status: "AMBIGUOUS" },
      }),
    ]);

    expect(result.canImport).toBe(false);
    expect(result.invalidDescriptionCount).toBe(1);
    expect(result.invalidPriceCount).toBe(1);
    expect(result.unresolvedCurrencyCount).toBe(1);
    expect([...result.invalidLineIds]).toEqual(["empty", "price", "currency"]);
  });

  it("reports repeated supplier codes without blocking the import", () => {
    const result = validateSupplierImportLines([
      line({ id: "one", supplier_code: " ab-1 " }),
      line({ id: "two", supplier_code: "AB-1" }),
      line({ id: "three", supplier_code: "ab-1" }),
    ]);

    expect(result.duplicateCodeCount).toBe(2);
    expect(result.canImport).toBe(true);
  });
});
