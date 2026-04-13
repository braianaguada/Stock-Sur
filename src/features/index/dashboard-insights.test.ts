import { describe, expect, it } from "vitest";
import { buildDashboardInsights } from "@/features/index/dashboard-insights";

describe("dashboard insights", () => {
  it("builds safe empty-state metrics when there is no data", () => {
    const insights = buildDashboardInsights({
      items: [],
      movements: [],
      pricingBase: [],
      suppliersCount: 0,
      quotesCount: 0,
      now: new Date("2026-04-13T12:00:00.000Z"),
    });

    expect(insights.metrics.inventoryValue).toBe(0);
    expect(insights.metrics.itemsWithStock).toBe(0);
    expect(insights.metrics.itemsWithoutCost).toBe(0);
    expect(insights.stockComposition).toHaveLength(0);
    expect(insights.hasStockData).toBe(false);
    expect(insights.hasMovementData).toBe(false);
    expect(insights.monthlyMovements).toHaveLength(6);
  });

  it("calculates valued stock, missing costs and top capital correctly", () => {
    const insights = buildDashboardInsights({
      items: [
        { id: "a", name: "Cable taller", sku: "CAB-01", attributes: "2 x 1,5 mm", category: "Electricidad", is_active: true },
        { id: "b", name: "Valvula 1/2", sku: "VAL-01", attributes: null, category: "Sanitaria", is_active: true },
        { id: "c", name: "Filtro", sku: "FIL-01", attributes: null, category: null, is_active: true },
      ],
      movements: [
        { item_id: "a", type: "IN", quantity: 10, created_at: "2026-04-01T10:00:00.000Z" },
        { item_id: "a", type: "OUT", quantity: 2, created_at: "2026-04-03T10:00:00.000Z" },
        { item_id: "b", type: "IN", quantity: 5, created_at: "2026-03-01T10:00:00.000Z" },
      ],
      pricingBase: [
        { item_id: "a", base_cost: 1000 },
        { item_id: "b", base_cost: 0 },
        { item_id: "c", base_cost: 800 },
      ],
      suppliersCount: 4,
      quotesCount: 2,
      now: new Date("2026-04-13T12:00:00.000Z"),
    });

    expect(insights.metrics.inventoryValue).toBe(8000);
    expect(insights.metrics.itemsWithStock).toBe(2);
    expect(insights.metrics.itemsWithoutCost).toBe(1);
    expect(insights.metrics.valuedItemsShare).toBe(50);
    expect(insights.topItemsByValue[0]?.name).toBe("Cable taller - 2 x 1,5 mm");
    expect(insights.categoryValues[0]).toEqual({
      category: "Electricidad",
      value: 8000,
    });
  });
});
