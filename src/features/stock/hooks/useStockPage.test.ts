import { describe, expect, it } from "vitest";
import { buildStockByItemId, getStockMovementDraftKey, sanitizeStockMovementItemSearch } from "./useStockPage";

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

describe("stock movement tenant state", () => {
  it("scopes drafts by user and company", () => {
    expect(getStockMovementDraftKey("user-1", "company-1")).toBe(
      "stock:new-movement-draft:user-1:company-1",
    );
    expect(getStockMovementDraftKey(null, "company-1")).toBeNull();
  });

  it("builds dialog stock from the complete catalog, not the filtered table", () => {
    const stock = buildStockByItemId([
      { item_id: "item-visible", total: 4 },
      { item_id: "item-filtered", total: 17 },
    ]);

    expect(stock.get("item-filtered")).toBe(17);
    expect(stock.has("missing-item")).toBe(false);
  });
});
