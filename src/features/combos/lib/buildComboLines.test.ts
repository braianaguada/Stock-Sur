import { describe, expect, it } from "vitest";
import { buildComboLines } from "./buildComboLines";

const items = [
  { id: "a", sku: "SKU-A", name: "Item A", brand: "Marca", model: "Modelo", attributes: "Atributo", unit: "un" },
  { id: "b", sku: "SKU-B", name: "Item B", unit: "m" },
];

const priceRows = new Map([
  [
    "a",
    {
      item_id: "a",
      is_active: true,
      base_cost: 5,
      calculated_price: 10.4,
      flete_pct: 1,
      utilidad_pct: 2,
      impuesto_pct: 3,
      final_price_override: null,
      items: null,
    },
  ],
  [
    "b",
    {
      item_id: "b",
      is_active: true,
      base_cost: 10,
      calculated_price: 20,
      flete_pct: null,
      utilidad_pct: null,
      impuesto_pct: null,
      final_price_override: null,
      items: null,
    },
  ],
]);

describe("buildComboLines", () => {
  it("expands combo lines into real document lines", () => {
    const lines = buildComboLines({
      comboName: "Combo",
      lines: [
        { item_id: "a", quantity: 3, line_order: 1 },
        { item_id: "b", quantity: 2, line_order: 2 },
      ],
      availableItems: items,
      priceByItem: new Map([["a", 10.4], ["b", 20]]),
      priceListItemByItemId: priceRows,
      applyRounding: (price) => Math.round(price),
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    expect(lines).toHaveLength(2);
    expect(lines[0].item_id).toBe("a");
    expect(lines[0].description).toBe("Item A - Marca | Modelo | Atributo");
    expect(lines[0].quantity).toBe(3);
    expect(lines[0].unit_price).toBe(10);
    expect(lines[0].suggested_unit_price).toBe(10);
    expect(lines[0].unrounded_suggested_unit_price).toBe(10.4);
    expect(lines[0].base_cost_snapshot).toBe(5);
  });

  it("applies the multiplier to every line", () => {
    const lines = buildComboLines({
      comboName: "Combo",
      lines: [{ item_id: "a", quantity: 3, line_order: 1 }],
      multiplier: 2,
      availableItems: items,
      priceByItem: new Map([["a", 10]]),
      priceListItemByItemId: priceRows,
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
        priceListItemByItemId: priceRows,
        applyRounding: (price) => price,
        nowIso: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/multiplicador/i);
  });
});
