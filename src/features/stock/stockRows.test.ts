import { describe, expect, it } from "vitest";
import {
  buildStockRows,
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

  it("uses manual monthly demand and the existing health thresholds", () => {
    const [row] = buildStockRows(
      [stockItem({ demand_profile: "HIGH", demand_monthly_estimate: 30 })],
      [movement({ quantity: 10 })],
      NOW,
    );

    expect(row.demand_daily).toBe(1);
    expect(row.days_of_cover).toBe(10);
    expect(row.health).toBe("RED");
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
