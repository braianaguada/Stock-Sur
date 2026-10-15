import type { DashboardInsights } from "./dashboard-insights";
import { buildDashboardViews, type DashboardView } from "./dashboard-view-model";

export type PeriodPreset = "day" | "week" | "month" | "previous-month" | "custom";
export type PeriodPayload = { timeseries: unknown; products: unknown };
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
export function records(value: unknown) { return Array.isArray(value) ? value.map(record) : []; }

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function dashboardPeriod(preset: PeriodPreset, customFrom: string, customTo: string, today = new Date()) {
  const from = new Date(today);
  const to = new Date(today);
  if (preset === "week") from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (preset === "month") from.setDate(1);
  if (preset === "previous-month") {
    from.setDate(1);
    from.setMonth(from.getMonth() - 1);
    to.setDate(0);
  }
  return { granularity: "day" as const, from: preset === "custom" ? customFrom : iso(from), to: preset === "custom" ? customTo : iso(to) };
}
export function periodError(from: string, to: string) {
  const dateValue = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
  };
  const first = dateValue(from), last = dateValue(to);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "Completá ambas fechas.";
  if (first > last) return "La fecha inicial debe ser anterior o igual a la final.";
  if ((last - first) / 86_400_000 + 1 > 366) return "Seleccioná un intervalo de hasta 366 días.";
  return null;
}

/** Temporal views use only the selected RPC period; stock remains a current snapshot. */
export function buildPeriodViews(dashboard: DashboardInsights, payload?: PeriodPayload): DashboardView[] {
  if (!payload) return buildDashboardViews(dashboard).filter(view => view.key === "inventory");
  const buckets = records(record(payload.timeseries).buckets);
  const sum = (key: string) => buckets.reduce((total, bucket) => total + number(bucket[key]), 0);
  const points = (key: string) => buckets.map(bucket => ({ label: String(bucket.periodStart), value: number(bucket[key]) }));
  return buildDashboardViews(dashboard).map(view => {
    if (view.key === "inventory") return view;
    if (view.key === "sales") return {
      ...view, description: "Cobros de caja del intervalo seleccionado", hasActivity: sum("salesCount") > 0,
      metrics: [
        { key: "period-sales", label: "Cobros del período", value: sum("sales"), format: "currency" },
        { key: "period-count", label: "Operaciones de caja", value: sum("salesCount"), format: "number" },
        { key: "period-ticket", label: "Ticket promedio", value: sum("salesCount") ? sum("sales") / sum("salesCount") : 0, format: "currency" },
      ],
      series: [{ key: "period-sales", label: "Cobros", format: "currency", points: points("sales") }],
    };
    return {
      ...view, description: "Caja y margen del intervalo seleccionado",
      hasActivity: sum("salesCount") + sum("expenseCount") + sum("documentCount") > 0,
      metrics: [
        { key: "period-net", label: "Resultado de caja", value: sum("cashNet"), format: "currency" },
        { key: "period-profit", label: "Ganancia bruta", value: sum("grossProfit"), format: "currency" },
        { key: "period-margin", label: "Margen sin impuestos", value: sum("netRevenue") ? sum("grossProfit") / sum("netRevenue") * 100 : 0, format: "percent" },
      ],
      series: [
        { key: "period-net", label: "Resultado de caja", format: "currency", points: points("cashNet") },
        { key: "period-profit", label: "Ganancia bruta", format: "currency", points: points("grossProfit") },
      ],
    };
  });
}

export function periodPayments(payload: PeriodPayload) {
  return records(record(payload.timeseries).paymentMethods).map(payment => ({
    method: String(payment.method ?? ""), total: number(payment.total), count: number(payment.count),
  }));
}
