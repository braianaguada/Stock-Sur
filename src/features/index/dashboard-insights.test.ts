import { describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD, mergeDashboardInsights, normalizeDashboardInsights } from "@/features/index/dashboard-insights";

describe("dashboard insights", () => {
  it("builds a safe empty dashboard from invalid data", () => {
    const insights = normalizeDashboardInsights(null);

    expect(insights.metrics.inventoryValue).toBe(0);
    expect(insights.metrics.salesMonth).toBe(0);
    expect(insights.metrics.grossProfitMonth).toBe(0);
    expect(insights.actions).toEqual([]);
    expect(insights.monthlySales).toEqual([]);
    expect(insights.monthlyProfit).toEqual([]);
    expect(insights.capabilities.stock).toBe(false);
  });

  it("honors explicit stock access and supports legacy stock-shaped responses", () => {
    expect(normalizeDashboardInsights({
      capabilities: { stock: false },
      metrics: { inventoryValue: 12500 },
    }).capabilities.stock).toBe(false);

    expect(normalizeDashboardInsights({
      metrics: { inventoryValue: 0 },
      categoryValues: [],
    }).capabilities.stock).toBe(true);
  });

  it("merges business metrics and charts into the operational dashboard", () => {
    const insights = mergeDashboardInsights(EMPTY_DASHBOARD, {
      metrics: {
        expensesMonth: "2500",
        cashNetMonth: "6500",
        averageTicket: "2250",
        salesNetMonth: "7200",
        taxMonth: "1800",
        productCostMonth: "4100",
        grossProfitMonth: "3100",
        profitMarginPct: "43.1",
      },
      monthlyCash: [{ month: "2026-06", sales: "9000", expenses: "2500", net: "6500", count: 4 }],
      monthlyProfit: [{ month: "2026-06", grossRevenue: "9000", netRevenue: "7200", tax: "1800", productCost: "4100", grossProfit: "3100", profitMarginPct: "43.1", count: 4 }],
      paymentMethods: [{ method: "EFECTIVO", total: "5000", count: 2 }],
      slowStock: [{ itemId: "slow", name: "Sin salida", quantity: "3", stockValue: "6000" }],
      stockVelocity: [{ itemId: "fast", name: "Con salida", out30: "12", currentStock: "4" }],
    });

    expect(insights.metrics.cashNetMonth).toBe(6500);
    expect(insights.metrics.grossProfitMonth).toBe(3100);
    expect(insights.monthlyCash[0]?.expenses).toBe(2500);
    expect(insights.monthlyProfit[0]?.productCost).toBe(4100);
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
        profitMarginPct: "38.5",
      },
      actions: [
        { key: "cost", label: "Sin costo", count: "3", detail: "Revisar", href: "/prices", tone: "warning" },
        { key: "unknown", label: "Otro", count: 1, tone: "unsupported" },
      ],
      monthlySales: [{ month: "2026-06", total: "7000", count: "4" }],
      monthlyProfit: [{ month: "2026-06", grossRevenue: "9000", netRevenue: "7200", tax: "1800", productCost: "4300", grossProfit: "2900", profitMarginPct: "40.3", count: "4" }],
      topItemsByValue: [{ itemId: "a", name: "Cable", stockValue: "8000", quantity: "4", baseCost: "2000" }],
    });

    expect(insights.metrics.inventoryValue).toBe(12500.5);
    expect(insights.metrics.salesMonth).toBe(9000);
    expect(insights.metrics.profitMarginPct).toBe(38.5);
    expect(insights.actions[0]).toMatchObject({ count: 3, tone: "warning" });
    expect(insights.actions[1]?.tone).toBe("default");
    expect(insights.monthlySales[0]).toEqual({ month: "2026-06", total: 7000, count: 4 });
    expect(insights.monthlyProfit[0]?.grossProfit).toBe(2900);
    expect(insights.topItemsByValue[0]?.stockValue).toBe(8000);
  });
});
