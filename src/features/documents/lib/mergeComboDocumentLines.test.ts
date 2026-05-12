import { describe, expect, it } from "vitest";
import type { LineDraft } from "@/features/documents/types";
import { mergeComboDocumentLines } from "./mergeComboDocumentLines";

function buildLine(overrides: Partial<LineDraft> = {}): LineDraft {
  return {
    item_id: "item-a",
    sku_snapshot: "SKU-A",
    description: "Producto A",
    unit: "un",
    quantity: 1,
    unit_price: 100,
    pricing_mode: "LIST_PRICE",
    suggested_unit_price: 100,
    base_cost_snapshot: 50,
    list_flete_pct_snapshot: 5,
    list_utilidad_pct_snapshot: 10,
    list_impuesto_pct_snapshot: 21,
    manual_margin_pct: null,
    price_overridden_by: null,
    price_overridden_at: null,
    ...overrides,
  };
}

describe("mergeComboDocumentLines", () => {
  it("adds combo lines the first time", () => {
    const next = mergeComboDocumentLines([], [
      buildLine({ item_id: "item-a", quantity: 3 }),
      buildLine({ item_id: "item-b", sku_snapshot: "SKU-B", description: "Producto B", quantity: 1, unit_price: 50, suggested_unit_price: 50 }),
    ]);

    expect(next).toHaveLength(2);
    expect(next.map((line) => [line.item_id, line.quantity])).toEqual([
      ["item-a", 3],
      ["item-b", 1],
    ]);
  });

  it("merges repeated combo items into the existing row", () => {
    const next = mergeComboDocumentLines(
      [
        buildLine({ item_id: "item-a", quantity: 3 }),
        buildLine({ item_id: "item-b", sku_snapshot: "SKU-B", description: "Producto B", quantity: 1, unit_price: 50, suggested_unit_price: 50 }),
      ],
      [
        buildLine({ item_id: "item-a", quantity: 3 }),
        buildLine({ item_id: "item-b", sku_snapshot: "SKU-B", description: "Producto B", quantity: 1, unit_price: 50, suggested_unit_price: 50 }),
      ],
    );

    expect(next).toHaveLength(2);
    expect(next.map((line) => [line.item_id, line.quantity])).toEqual([
      ["item-a", 6],
      ["item-b", 2],
    ]);
  });

  it("keeps manual price overrides when the item already exists", () => {
    const next = mergeComboDocumentLines(
      [
        buildLine({
          item_id: "item-a",
          quantity: 4,
          pricing_mode: "MANUAL_PRICE",
          unit_price: 140,
          suggested_unit_price: 100,
          price_overridden_by: "user-1",
          price_overridden_at: "2026-05-12T00:00:00.000Z",
        }),
      ],
      [buildLine({ item_id: "item-a", quantity: 6, unit_price: 100, suggested_unit_price: 100 })],
    );

    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe(10);
    expect(next[0].unit_price).toBe(140);
    expect(next[0].pricing_mode).toBe("MANUAL_PRICE");
    expect(next[0].price_overridden_by).toBe("user-1");
  });

  it("adds multiplied quantities without creating duplicate item rows", () => {
    const next = mergeComboDocumentLines(
      [buildLine({ item_id: "item-a", quantity: 4 })],
      [buildLine({ item_id: "item-a", quantity: 6 })],
    );

    expect(next).toHaveLength(1);
    expect(next[0].item_id).toBe("item-a");
    expect(next[0].quantity).toBe(10);
  });
});
