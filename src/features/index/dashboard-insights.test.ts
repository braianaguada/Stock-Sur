import { describe, expect, it } from "vitest";
import { normalizeDashboardInsights } from "@/features/index/dashboard-insights";

describe("dashboard insights", () => {
  it("builds a safe empty dashboard from invalid data", () => {
    const insights = normalizeDashboardInsights(null);

    expect(insights.metrics.inventoryValue).toBe(0);
    expect(insights.metrics.salesMonth).toBe(0);
    expect(insights.actions).toEqual([]);
    expect(insights.monthlySales).toEqual([]);
  });

  it("normalizes numeric database values and action tones", () => {
    const insights = normalizeDashboardInsights({
      metrics: {
        inventoryValue: "12500.50",
        itemsWithStock: 8,
        salesMonth: "9000",
      },
      actions: [
        { key: "cost", label: "Sin costo", count: "3", detail: "Revisar", href: "/prices", tone: "warning" },
        { key: "unknown", label: "Otro", count: 1, tone: "unsupported" },
      ],
      monthlySales: [{ month: "2026-06", total: "7000", count: "4" }],
      topItemsByValue: [{ itemId: "a", name: "Cable", stockValue: "8000", quantity: "4", baseCost: "2000" }],
    });

    expect(insights.metrics.inventoryValue).toBe(12500.5);
    expect(insights.metrics.salesMonth).toBe(9000);
    expect(insights.actions[0]).toMatchObject({ count: 3, tone: "warning" });
    expect(insights.actions[1]?.tone).toBe("default");
    expect(insights.monthlySales[0]).toEqual({ month: "2026-06", total: 7000, count: 4 });
    expect(insights.topItemsByValue[0]?.stockValue).toBe(8000);
  });
});
