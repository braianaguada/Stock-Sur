import { describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD, type DashboardInsights } from "@/features/index/dashboard-insights";
import { buildDashboardOperationalKpis, buildDashboardViews } from "@/features/index/dashboard-view-model";

function dashboardWith(overrides: Partial<DashboardInsights>): DashboardInsights {
  return {
    ...EMPTY_DASHBOARD,
    ...overrides,
    capabilities: overrides.capabilities ?? { stock: true },
    metrics: {
      ...EMPTY_DASHBOARD.metrics,
      ...overrides.metrics,
    },
  };
}

describe("dashboard view model", () => {
  it("exposes the three views with real application routes", () => {
    const views = buildDashboardViews(dashboardWith({}));

    expect(views.map(({ key, href }) => ({ key, href }))).toEqual([
      { key: "sales", href: "/documents" },
      { key: "inventory", href: "/stock" },
      { key: "profitability", href: "/cash-totals" },
    ]);
  });

  it("does not expose inventory data or routes without the stock capability", () => {
    const views = buildDashboardViews(dashboardWith({ capabilities: { stock: false } }));

    expect(views.map((view) => view.key)).toEqual(["sales", "profitability"]);
    expect(views.some((view) => view.href === "/stock")).toBe(false);
  });

  it("treats real zero-valued periods as activity when documents exist", () => {
    const views = buildDashboardViews(dashboardWith({
      monthlySales: [{ month: "2026-07", total: 0, count: 1 }],
    }));

    expect(views[0]?.hasActivity).toBe(true);
  });

  it("keeps sales and inventory values numeric with explicit format metadata", () => {
    const views = buildDashboardViews(dashboardWith({
      metrics: {
        ...EMPTY_DASHBOARD.metrics,
        salesMonth: 48_320_450,
        salesToday: 1_250_000,
        averageTicket: 85_400,
        inventoryValue: 17_500_000,
        inventoryUnits: 1_245,
        slowStockValue: 640_000,
      },
      monthlySales: [{ month: "2026-07", total: 48_320_450, count: 32 }],
      categoryValues: [{ category: "Herramientas", value: 8_100_000 }],
    }));

    expect(views[0]?.metrics).toEqual([
      { key: "sales-month", label: "Ventas del mes", value: 48_320_450, format: "currency" },
      { key: "sales-today", label: "Ventas de hoy", value: 1_250_000, format: "currency" },
      { key: "average-ticket", label: "Ticket promedio", value: 85_400, format: "currency" },
    ]);
    expect(views[0]?.series[0]?.points).toEqual([{ label: "2026-07", value: 48_320_450 }]);
    expect(views[1]?.metrics[1]).toEqual({
      key: "inventory-units",
      label: "Unidades en stock",
      value: 1_245,
      format: "number",
    });
    expect(views[1]?.series[0]?.points).toEqual([{ label: "Herramientas", value: 8_100_000 }]);
  });

  it("represents cash and profit independently without deriving causality", () => {
    const [,, profitability] = buildDashboardViews(dashboardWith({
      metrics: {
        ...EMPTY_DASHBOARD.metrics,
        cashNetMonth: -125_000,
        grossProfitMonth: 3_100_000,
        profitMarginPct: 20.4,
      },
      monthlyCash: [{ month: "2026-07", sales: 8_000_000, expenses: 8_125_000, net: -125_000, count: 9 }],
      monthlyProfit: [{
        month: "2026-07",
        grossRevenue: 10_000_000,
        netRevenue: 8_000_000,
        tax: 2_000_000,
        productCost: 4_900_000,
        grossProfit: 3_100_000,
        profitMarginPct: 20.4,
        count: 9,
      }],
    }));

    expect(profitability?.metrics).toEqual([
      { key: "cash-net", label: "Resultado de caja", value: -125_000, format: "currency" },
      { key: "gross-profit", label: "Ganancia bruta", value: 3_100_000, format: "currency" },
      { key: "profit-margin", label: "Margen", value: 20.4, format: "percent" },
    ]);
    expect(profitability?.series).toEqual([
      {
        key: "monthly-cash-net",
        label: "Resultado de caja",
        format: "currency",
        points: [{ label: "2026-07", value: -125_000 }],
      },
      {
        key: "monthly-gross-profit",
        label: "Ganancia bruta",
        format: "currency",
        points: [{ label: "2026-07", value: 3_100_000 }],
      },
    ]);
  });
});

describe("dashboard operational KPIs", () => {
  it("derives actionable KPIs without inventing new business data", () => {
    const kpis = buildDashboardOperationalKpis(dashboardWith({
      metrics: {
        ...EMPTY_DASHBOARD.metrics,
        accountsReceivable: 850_000,
        salesGrowthPct: -12.5,
        inventoryValue: 10_000_000,
        slowStockValue: 2_500_000,
        slowStockItems: 18,
        valuedItemsShare: 92,
        itemsWithoutCost: 7,
      },
    }));

    expect(kpis).toEqual([
      expect.objectContaining({ key: "receivables", value: 850_000, tone: "warning", href: "/customer-account" }),
      expect.objectContaining({ key: "sales-growth", value: -12.5, tone: "danger" }),
      expect.objectContaining({ key: "valued-stock", value: 92, tone: "warning" }),
      expect.objectContaining({ key: "slow-stock", value: 25, tone: "warning" }),
    ]);
  });

  it("does not expose stock-derived KPIs without stock.view", () => {
    const kpis = buildDashboardOperationalKpis(dashboardWith({
      capabilities: { stock: false },
      metrics: {
        ...EMPTY_DASHBOARD.metrics,
        inventoryValue: 10_000_000,
        slowStockValue: 8_000_000,
        valuedItemsShare: 40,
      },
    }));

    expect(kpis.map(({ key }) => key)).toEqual(["receivables", "sales-growth"]);
    expect(kpis.some(({ href }) => href === "/stock")).toBe(false);
  });

  it("keeps stock ratios bounded when upstream values are inconsistent", () => {
    const kpis = buildDashboardOperationalKpis(dashboardWith({
      metrics: {
        ...EMPTY_DASHBOARD.metrics,
        inventoryValue: 100,
        slowStockValue: 250,
        valuedItemsShare: 130,
      },
    }));

    expect(kpis.find(({ key }) => key === "slow-stock")?.value).toBe(100);
    expect(kpis.find(({ key }) => key === "valued-stock")?.value).toBe(100);
  });
});
