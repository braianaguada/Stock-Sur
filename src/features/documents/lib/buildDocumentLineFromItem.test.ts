import { describe, expect, it } from "vitest";
import { buildDocumentLineFromItem } from "./buildDocumentLineFromItem";
import type { LineDraft, PriceListItemRow } from "../types";

const item = {
  id: "item-1",
  sku: "SS-001",
  name: "Caño estructural",
  brand: "Stock Sur",
  model: "40x40",
  attributes: "2mm",
  unit: "un",
};

const priceRow: PriceListItemRow = {
  item_id: "item-1",
  is_active: true,
  base_cost: 1000,
  calculated_price: 1256.35,
  flete_pct: 5,
  utilidad_pct: 20,
  impuesto_pct: 21,
  final_price_override: null,
  items: item,
};

describe("buildDocumentLineFromItem", () => {
  it("builds the complete document line shape used by manual item selection", () => {
    const line = buildDocumentLineFromItem({
      item,
      quantity: 2,
      priceListRow: priceRow,
      priceByItem: new Map([["item-1", 1256.35]]),
      applyRounding: () => 1300,
      forceListPrice: true,
    });

    expect(line).toMatchObject({
      item_id: "item-1",
      sku_snapshot: "SS-001",
      description: "Caño estructural - Stock Sur | 40x40 | 2mm",
      unit: "un",
      quantity: 2,
      unit_price: 1300,
      pricing_mode: "LIST_PRICE",
      suggested_unit_price: 1300,
      unrounded_suggested_unit_price: 1256.35,
      base_cost_snapshot: 1000,
      list_flete_pct_snapshot: 5,
      list_utilidad_pct_snapshot: 20,
      list_impuesto_pct_snapshot: 21,
      manual_margin_pct: null,
      price_overridden_by: null,
      price_overridden_at: null,
    });
  });

  it("preserves manual price mode when refreshing an existing line", () => {
    const currentLine: LineDraft = {
      item_id: "item-1",
      sku_snapshot: "SS-001",
      description: "Caño estructural",
      unit: "un",
      quantity: 1,
      unit_price: 1500,
      pricing_mode: "MANUAL_PRICE",
      suggested_unit_price: 1300,
      base_cost_snapshot: 1000,
      list_flete_pct_snapshot: 5,
      list_utilidad_pct_snapshot: 20,
      list_impuesto_pct_snapshot: 21,
      manual_margin_pct: null,
      price_overridden_by: "user-1",
      price_overridden_at: "2026-05-16T00:00:00.000Z",
    };

    const line = buildDocumentLineFromItem({
      item,
      quantity: 3,
      currentLine,
      priceListRow: priceRow,
      priceByItem: new Map([["item-1", 1256.35]]),
      applyRounding: () => 1300,
    });

    expect(line.quantity).toBe(3);
    expect(line.unit_price).toBe(1500);
    expect(line.pricing_mode).toBe("MANUAL_PRICE");
    expect(line.price_overridden_by).toBe("user-1");
  });
});
