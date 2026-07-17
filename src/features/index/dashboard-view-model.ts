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
