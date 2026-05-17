import { describe, expect, it } from "vitest";
import { buildComboLines } from "./buildComboLines";

const items = [
  { id: "a", sku: "SKU-A", name: "Item A", unit: "un" },
  { id: "b", sku: "SKU-B", name: "Item B", unit: "m" },
];

describe("buildComboLines", () => {
  it("expands combo lines into real document lines", () => {
    const lines = buildComboLines({
      comboName: "Combo",
      lines: [
        { item_id: "a", quantity: 3, line_order: 1 },
        { item_id: "b", quantity: 2, line_order: 2 },
      ],
      availableItems: items,
      priceByItem: new Map([["a", 10], ["b", 20]]),
      priceListItemByItemId: new Map(),
      applyRounding: (price) => price,
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    expect(lines).toHaveLength(2);
    expect(lines[0].item_id).toBe("a");
    expect(lines[0].quantity).toBe(3);
    expect(lines[0].unit_price).toBe(10);
  });

  it("applies the multiplier to every line", () => {
    const lines = buildComboLines({
      comboName: "Combo",
      lines: [{ item_id: "a", quantity: 3, line_order: 1 }],
      multiplier: 2,
      availableItems: items,
      priceByItem: new Map([["a", 10]]),
      priceListItemByItemId: new Map(),
      applyRounding: (price) => price,
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(6);
  });

  it("does not create a synthetic document line for an empty combo", () => {
    const lines = buildComboLines({
      comboName: "Combo vacio",
      lines: [],
      availableItems: items,
      priceByItem: new Map(),
      priceListItemByItemId: new Map(),
      applyRounding: (price) => price,
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(lines).toEqual([]);
  });

  it("rejects invalid multipliers", () => {
    expect(() =>
      buildComboLines({
        comboName: "Combo",
        lines: [{ item_id: "a", quantity: 3, line_order: 1 }],
        multiplier: 0,
        availableItems: items,
        priceByItem: new Map([["a", 10]]),
        priceListItemByItemId: new Map(),
        applyRounding: (price) => price,
        nowIso: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/multiplicador/i);
  });

  it("uses active product override from combo lines without rounding", () => {
    const lines = buildComboLines({
      comboName: "Combo",
      lines: [{ item_id: "a", quantity: 1, line_order: 1 }],
      availableItems: items,
      priceByItem: new Map([["a", 2100]]),
      priceListItemByItemId: new Map([
        [
          "a",
          {
            item_id: "a",
            is_active: true,
            base_cost: 1000,
            calculated_price: 1850,
            flete_pct: 5,
            utilidad_pct: 10,
            impuesto_pct: 21,
            final_price_override: 2100,
            manual_price_enabled: true,
            manual_price_note: null,
            items: null,
          },
        ],
      ]),
      applyRounding: () => 2000,
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(lines[0].unit_price).toBe(2100);
    expect(lines[0].suggested_unit_price).toBe(2100);
  });
});
