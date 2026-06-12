import { describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD, mergeDashboardInsights, normalizeDashboardInsights } from "@/features/index/dashboard-insights";

describe("dashboard insights", () => {
  it("builds a safe empty dashboard from invalid data", () => {
    const insights = normalizeDashboardInsights(null);

    expect(insights.metrics.inventoryValue).toBe(0);
    expect(insights.metrics.salesMonth).toBe(0);
    expect(insights.actions).toEqual([]);
    expect(insights.monthlySales).toEqual([]);
  });

  it("merges business metrics and charts into the operational dashboard", () => {
    const insights = mergeDashboardInsights(EMPTY_DASHBOARD, {
      metrics: { expensesMonth: "2500", cashNetMonth: "6500", averageTicket: "2250" },
      monthlyCash: [{ month: "2026-06", sales: "9000", expenses: "2500", net: "6500", count: 4 }],
      paymentMethods: [{ method: "EFECTIVO", total: "5000", count: 2 }],
      slowStock: [{ itemId: "slow", name: "Sin salida", quantity: "3", stockValue: "6000" }],
      stockVelocity: [{ itemId: "fast", name: "Con salida", out30: "12", currentStock: "4" }],
    });

    expect(insights.metrics.cashNetMonth).toBe(6500);
    expect(insights.monthlyCash[0]?.expenses).toBe(2500);
    expect(insights.paymentMethods[0]?.method).toBe("EFECTIVO");
    expect(insights.slowStock[0]?.stockValue).toBe(6000);
    expect(insights.stockVelocity[0]?.out30).toBe(12);
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
