import { describe, expect, it } from "vitest";
import { sanitizeStockMovementItemSearch } from "./useStockPage";

describe("sanitizeStockMovementItemSearch", () => {
  it("removes invalid fallback labels from stored stock movement drafts", () => {
    expect(sanitizeStockMovementItemSearch("")).toBe("");
    expect(sanitizeStockMovementItemSearch("undefined - undefined")).toBe("");
    expect(sanitizeStockMovementItemSearch("Item sin nombre")).toBe("");
    expect(sanitizeStockMovementItemSearch("Item sin nombre - Marca | Modelo")).toBe("Marca | Modelo");
  });

  it("keeps valid item search text", () => {
    expect(sanitizeStockMovementItemSearch("  ACEITE - REFRIOIL | 1 L  ")).toBe("ACEITE - REFRIOIL | 1 L");
  });
});
