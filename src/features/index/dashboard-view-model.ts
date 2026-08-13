import type { DashboardInsights } from "@/features/index/dashboard-insights";

export type DashboardValueFormat = "currency" | "number" | "percent";

export type DashboardViewMetric = {
  key: string;
  label: string;
  value: number;
  format: DashboardValueFormat;
};

export type DashboardViewPoint = {
  label: string;
  value: number;
};

export type DashboardViewSeries = {
  key: string;
  label: string;
  format: DashboardValueFormat;
  points: DashboardViewPoint[];
};

export type DashboardView = {
  key: "sales" | "inventory" | "profitability";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  hasActivity: boolean;
  metrics: DashboardViewMetric[];
  series: DashboardViewSeries[];
};

export type DashboardOperationalKpi = {
  key: "receivables" | "sales-growth" | "valued-stock" | "slow-stock";
  label: string;
  value: number;
  format: DashboardValueFormat;
  detail: string;
  href: string;
  tone: "default" | "positive" | "warning" | "danger";
};

/**
 * Maps the dashboard response to presentation-ready, locale-independent values.
 * Formatting and chart rendering remain responsibilities of the UI.
 */
export function buildDashboardViews(insights: DashboardInsights): DashboardView[] {
  const { metrics } = insights;

  const views: DashboardView[] = [
    {
      key: "sales",
      title: "Ventas",
      description: "Actividad comercial del período",
      href: "/documents",
      actionLabel: "Ver documentos",
      hasActivity: insights.monthlySales.some(({ count }) => count > 0) || metrics.salesTodayCount > 0,
      metrics: [
        metric("sales-month", "Ventas del mes", metrics.salesMonth, "currency"),
        metric("sales-today", "Ventas de hoy", metrics.salesToday, "currency"),
        metric("average-ticket", "Ticket promedio", metrics.averageTicket, "currency"),
      ],
      series: [
        series(
          "monthly-sales",
          "Ventas",
          "currency",
          insights.monthlySales.map(({ month, total }) => ({ label: month, value: total })),
        ),
      ],
    },
    {
      key: "inventory",
      title: "Inventario",
      description: "Valor y composición del stock actual",
      href: "/stock",
      actionLabel: "Ver stock",
      hasActivity: metrics.activeItems > 0 || insights.categoryValues.length > 0,
      metrics: [
        metric("inventory-value", "Valor de inventario", metrics.inventoryValue, "currency"),
        metric("inventory-units", "Unidades en stock", metrics.inventoryUnits, "number"),
        metric("slow-stock-value", "Valor sin rotación", metrics.slowStockValue, "currency"),
      ],
      series: [
        series(
          "category-values",
          "Valor por categoría",
          "currency",
          insights.categoryValues.map(({ category, value }) => ({ label: category, value })),
        ),
      ],
    },
    {
      key: "profitability",
      title: "Caja y rentabilidad",
      description: "Resultado de caja y margen del período",
      href: "/cash-totals",
      actionLabel: "Ver totales de caja",
      hasActivity: insights.monthlyCash.some(({ count }) => count > 0)
        || insights.monthlyProfit.some(({ count }) => count > 0),
      metrics: [
        metric("cash-net", "Resultado de caja", metrics.cashNetMonth, "currency"),
        metric("gross-profit", "Ganancia bruta", metrics.grossProfitMonth, "currency"),
        metric("profit-margin", "Margen", metrics.profitMarginPct, "percent"),
      ],
      series: [
        series(
          "monthly-cash-net",
          "Resultado de caja",
          "currency",
          insights.monthlyCash.map(({ month, net }) => ({ label: month, value: net })),
        ),
        series(
          "monthly-gross-profit",
          "Ganancia bruta",
          "currency",
          insights.monthlyProfit.map(({ month, grossProfit }) => ({ label: month, value: grossProfit })),
        ),
      ],
    },
  ];

  return insights.capabilities.stock
    ? views
    : views.filter(({ key }) => key !== "inventory");
}

/**
 * Builds a compact operational reading from metrics already calculated by the
 * dashboard RPCs. Stock indicators remain fail-closed when stock.view is absent.
 */
export function buildDashboardOperationalKpis(insights: DashboardInsights): DashboardOperationalKpi[] {
  const { metrics } = insights;
  const kpis: DashboardOperationalKpi[] = [
    {
      key: "receivables",
      label: "Pendiente de cobro",
      value: metrics.accountsReceivable,
      format: "currency",
      detail: "Saldo positivo total de clientes",
      href: "/customer-account",
      tone: metrics.accountsReceivable > 0 ? "warning" : "positive",
    },
    {
      key: "sales-growth",
      label: "Variación de ventas",
      value: metrics.salesGrowthPct,
      format: "percent",
      detail: "Contra el mismo tramo del mes anterior",
      href: "/documents",
      tone: metrics.salesGrowthPct < 0 ? "danger" : metrics.salesGrowthPct > 0 ? "positive" : "default",
    },
  ];

  if (!insights.capabilities.stock) return kpis;

  const slowStockShare = metrics.inventoryValue > 0
    ? Math.min(100, Math.max(0, metrics.slowStockValue / metrics.inventoryValue * 100))
    : 0;

  return [
    ...kpis,
    {
      key: "valued-stock",
      label: "Stock valorizado",
      value: Math.min(100, Math.max(0, metrics.valuedItemsShare)),
      format: "percent",
      detail: `${metrics.itemsWithoutCost} items con stock sin costo base`,
      href: "/price-lists?tab=base",
      tone: metrics.itemsWithoutCost > 0 ? "warning" : "positive",
    },
    {
      key: "slow-stock",
      label: "Capital sin rotación",
      value: slowStockShare,
      format: "percent",
      detail: `${metrics.slowStockItems} items · proporción del inventario valorizado`,
      href: "/stock",
      tone: slowStockShare >= 30 ? "danger" : slowStockShare > 0 ? "warning" : "positive",
    },
  ];
}

function metric(
  key: string,
  label: string,
  value: number,
  format: DashboardValueFormat,
): DashboardViewMetric {
  return { key, label, value, format };
}

function series(
  key: string,
  label: string,
  format: DashboardValueFormat,
  points: DashboardViewPoint[],
): DashboardViewSeries {
  return { key, label, format, points };
}
