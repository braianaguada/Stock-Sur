import { describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD } from "./dashboard-insights";
import { buildPeriodViews, dashboardPeriod, periodError, periodPayments } from "./dashboard-period";
import { queryKeys } from "@/lib/query-keys";

describe("dashboard selected period", () => {
  it("handles previous month across years and leap February", () => {
    expect(dashboardPeriod("previous-month", "", "", new Date(2026, 0, 31))).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(dashboardPeriod("previous-month", "", "", new Date(2024, 2, 31))).toMatchObject({ from: "2024-02-01", to: "2024-02-29" });
    expect(dashboardPeriod("week", "", "", new Date(2026, 9, 18))).toMatchObject({ from: "2026-10-12", to: "2026-10-18" });
  });
  it("rejects missing, invalid, reversed and oversized ranges", () => {
    expect(periodError("", "2026-10-01")).toBeTruthy();
    expect(periodError("2026-02-30", "2026-03-01")).toBeTruthy();
    expect(periodError("2026-10-02", "2026-10-01")).toBeTruthy();
    expect(periodError("2024-01-01", "2025-01-01")).toBeTruthy();
    expect(periodError("2024-01-01", "2024-12-31")).toBeNull();
    expect(periodError("2026-10-01", "2026-10-01")).toBeNull();
  });
  it("uses selected amounts and returns without leaking current month values", () => {
    const dashboard = { ...EMPTY_DASHBOARD, capabilities: { stock: true }, metrics: { ...EMPTY_DASHBOARD.metrics, salesMonth: 99999, inventoryValue: 500 } };
    const payload = { products: {}, timeseries: { buckets: [
      { periodStart: "2026-09-01", sales: 100, salesCount: 1, cashNet: 80, grossProfit: 40, netRevenue: 100, documentCount: 1 },
      { periodStart: "2026-09-02", sales: 50, salesCount: 1, cashNet: -10, grossProfit: -10, netRevenue: -20, documentCount: 1 },
    ], paymentMethods: [{ method: "EFECTIVO", total: 150, count: 2 }] } };
    const views = buildPeriodViews(dashboard, payload);
    expect(views[0].metrics.map(metric => metric.value)).toEqual([150, 2, 75]);
    expect(views[1].metrics[0].value).toBe(500);
    expect(views[2].metrics.map(metric => metric.value)).toEqual([70, 30, 37.5]);
    expect(views[2].series[1].points[1].value).toBe(-10);
    expect(periodPayments(payload)).toEqual([{ method: "EFECTIVO", total: 150, count: 2 }]);
    expect(buildPeriodViews(dashboard, { products: {}, timeseries: {} })[0].hasActivity).toBe(false);
    expect(buildPeriodViews({ ...dashboard, capabilities: { stock: false } }, payload).map(view => view.key)).not.toContain("inventory");
  });
  it("isolates cache by company and both date bounds", () => {
    const key = queryKeys.dashboard.period("a", "day", "2026-09-01", "2026-09-30");
    expect(queryKeys.dashboard.period("b", "day", "2026-09-01", "2026-09-30")).not.toEqual(key);
    expect(queryKeys.dashboard.period("a", "day", "2026-08-01", "2026-09-30")).not.toEqual(key);
    expect(queryKeys.dashboard.period("a", "day", "2026-09-01", "2026-10-01")).not.toEqual(key);
  });
  it("preserves authorized current inventory when the period is unavailable", () => {
    expect(buildPeriodViews({ ...EMPTY_DASHBOARD, capabilities: { stock: true } }).map(view => view.key)).toEqual(["inventory"]);
    expect(buildPeriodViews({ ...EMPTY_DASHBOARD, capabilities: { stock: false } })).toEqual([]);
  });
});
