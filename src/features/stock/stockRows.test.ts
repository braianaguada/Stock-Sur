import { describe, expect, it } from "vitest";
import {
  buildStockRows,
  buildStockRowsFromSummary,
  type StockItemSource,
  type StockMovementSource,
} from "./stockRows";

const NOW = new Date("2026-07-24T12:00:00.000Z").getTime();

function stockItem(overrides: Partial<StockItemSource> = {}): StockItemSource {
  return {
    id: "item-1",
    name: "Aceite",
    sku: "ACE-1",
    unit: "un",
    supplier: "Proveedor",
    brand: "Marca",
    model: null,
    attributes: null,
    category: "Lubricantes",
    demand_profile: "MEDIUM",
    demand_monthly_estimate: null,
    ...overrides,
  };
}

function movement(overrides: Partial<StockMovementSource> = {}): StockMovementSource {
  return {
    item_id: "item-1",
    type: "IN",
    quantity: 10,
    created_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildStockRows", () => {
  it("preserves prefixed RPC metadata, sorting and demand in summary rows", () => {
    const source = {
      item_id: "copper", item_name: "Caño cobre", item_sku: "COB-1", item_unit: "m",
      item_supplier: "Proveedor", item_brand: "Marca", item_model: "Modelo",
      item_attributes: "3/8", item_category: "Cobre", demand_profile: "HIGH" as const,
      demand_monthly_estimate: 30, total: 25, out_30d: 30, out_90d: 90,
      out_365d: 365, out_month_buckets_12m: Array(12).fill(30),
    };
    const rows = buildStockRowsFromSummary([source, { ...source, item_id: "a", item_name: "Aceite" }]);
    expect(rows.map(row => row.item_name)).toEqual(["Aceite", "Caño cobre"]);
    expect(rows[1]).toMatchObject({ ...Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith("item_") || key.startsWith("demand_"))), total: 25, demand_daily: 1, days_of_cover: 25, health: "YELLOW" });
  });
  it("combines catalog items and signed movements without losing tenant-scoped item metadata", () => {
    const rows = buildStockRows(
      [stockItem()],
      [
        movement({ type: "IN", quantity: 10 }),
        movement({ type: "OUT", quantity: 3 }),
        movement({ type: "ADJUSTMENT", quantity: -2 }),
      ],
      NOW,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      item_id: "item-1",
      item_name: "Aceite",
      item_supplier: "Proveedor",
      total: 5,
      demand_profile: "MEDIUM",
    });
    expect(rows[0].avg_daily_out_30d).toBeCloseTo(0.1);
  });

  it("calculates demand from actual outbound movements instead of the manual estimate", () => {
    const [row] = buildStockRows(
      [stockItem({ demand_profile: "HIGH", demand_monthly_estimate: 30 })],
      [movement({ quantity: 10 }), movement({ type: "OUT", quantity: 3 })],
      NOW,
    );

    expect(row.demand_daily).toBeCloseTo(
      (3 / 30) * 0.5 + (3 / 90) * 0.3 + (3 / 365) * 0.2,
    );
    expect(row.days_of_cover).toBeCloseTo(113.55, 1);
    expect(row.health).toBe("GREEN");
  });

  it("does not create demand when an item only has a manual estimate", () => {
    const [row] = buildStockRows(
      [stockItem({ demand_monthly_estimate: 30 })],
      [movement({ quantity: 10 })],
      NOW,
    );

    expect(row.demand_daily).toBe(0);
    expect(row.days_of_cover).toBeNull();
    expect(row.months_of_cover_low_rotation).toBeNull();
  });

  it("keeps movement-only items visible and sorts the resulting rows by name", () => {
    const rows = buildStockRows(
      [stockItem({ id: "item-z", name: "Zinc" })],
      [
        movement({
          item_id: "item-a",
          quantity: 4,
          items: {
            name: "Abrazadera",
            sku: "ABR-1",
            unit: "un",
            demand_profile: "LOW",
          },
        }),
      ],
      NOW,
    );

    expect(rows.map((row) => row.item_name)).toEqual(["Abrazadera", "Zinc"]);
    expect(rows[0]).toMatchObject({
      item_id: "item-a",
      total: 4,
      health: "GREEN",
    });
  });

  it("ignores old outbound movements when estimating current demand", () => {
    const [row] = buildStockRows(
      [stockItem()],
      [
        movement({ quantity: 8 }),
        movement({
          type: "OUT",
          quantity: 2,
          created_at: "2025-01-01T12:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(row.total).toBe(6);
    expect(row.demand_daily).toBe(0);
    expect(row.days_of_cover).toBeNull();
    expect(row.health).toBe("GREEN");
  });
});
