import { describe, expect, it } from "vitest";
import { calculateGrossMargin, markupToGrossMargin, summarizePriceListMargins } from "@/features/price-lists/margin";
import type { PriceListProductRow } from "@/features/price-lists/types";

const row = (overrides: Partial<PriceListProductRow> = {}): PriceListProductRow => ({
  item_id: "item-1",
  sku: "SKU-1",
  name: "Producto",
  attributes: null,
  brand: null,
  model: null,
  category: null,
  unit: "un",
  previous_base_cost: null,
  base_cost: 100,
  cost_variation_pct: null,
  calculated_price: 145.2,
  final_price_override: null,
  manual_price_enabled: false,
  manual_price_note: null,
  manual_price_updated_at: null,
  manual_price_updated_by: null,
  needs_recalculation: false,
  last_calculated_at: null,
  last_calculated_by: null,
  ...overrides,
});

describe("price-list margin helpers", () => {
  it("converts markup over cost into gross margin over net sales", () => {
    expect(markupToGrossMargin(20)).toBeCloseTo(16.6667, 3);
  });

  it("excludes tax and includes freight in the real cost", () => {
    expect(calculateGrossMargin({ baseCost: 100, grossPrice: 145.2, freightPct: 10, taxPct: 10 })).toBeCloseTo(16.6667, 3);
  });

  it("flags prices below target and products without an evaluable cost", () => {
    const summary = summarizePriceListMargins({
      rows: [row(), row({ item_id: "item-2", calculated_price: 100 }), row({ item_id: "item-3", base_cost: 0 })],
      freightPct: 10,
      taxPct: 10,
      targetMarginPct: markupToGrossMargin(20),
      resolveOperationalPrice: (item) => item.calculated_price,
    });

    expect(summary.evaluableCount).toBe(2);
    expect(summary.belowTargetCount).toBe(1);
    expect(summary.negativeMarginCount).toBe(1);
    expect(summary.missingCostCount).toBe(1);
  });
});
