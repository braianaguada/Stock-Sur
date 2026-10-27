import { describe, expect, it } from "vitest";
import { createManualQuoteLine, normalizeManualQuote, recalculateManualQuote } from "./manual-quote";

describe("manual quotation pricing", () => {
  it("adds freight to cost, then markup and included VAT, without a catalog item", () => {
    const line = recalculateManualQuote({ ...createManualQuoteLine(), description: "Manguera especial", base_cost_snapshot: 1000,
      list_flete_pct_snapshot: 10, manual_margin_pct: 30 });
    expect(line.unit_price).toBe(1730.3);
    expect(line.item_id).toBeNull();
    expect(normalizeManualQuote(line)).toEqual(line);
  });
  it("keeps a manually overridden final price and the cost breakdown when reopening", () => {
    const line = { ...createManualQuoteLine(), description: "Producto", base_cost_snapshot: 1000,
      list_utilidad_pct_snapshot: 30, manual_margin_pct: null, pricing_mode: "MANUAL_PRICE" as const, unit_price: 1500 };
    expect(normalizeManualQuote(line)).toMatchObject({ unit_price: 1500, base_cost_snapshot: 1000, list_utilidad_pct_snapshot: 30 });
    expect(recalculateManualQuote(line).unit_price).toBe(1573);
  });
  it.each([{ description: "" }, { quantity: 0 }, { quantity: NaN }, { base_cost_snapshot: -1 }, { manual_margin_pct: Infinity }, { unit_price: -1 }, { base_cost_snapshot: Number.MAX_VALUE, manual_margin_pct: 100 }])(
    "rejects invalid manual input %j", (patch) => {
      expect(() => normalizeManualQuote({ ...createManualQuoteLine(), description: "Producto", ...patch })).toThrow();
    },
  );
});
