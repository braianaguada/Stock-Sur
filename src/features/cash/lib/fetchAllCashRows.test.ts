import { describe, expect, it, vi } from "vitest";
import type { CashSaleRow } from "../types";
import { buildCashTotalsReport } from "./cashTotals";
import { fetchAllCashRows } from "./fetchAllCashRows";

const makeSale = (index: number): CashSaleRow => ({
  id: `sale-${index}`,
  sold_at: "2026-07-23T12:00:00.000Z",
  business_date: "2026-07-23",
  amount_total: 1,
  payment_method: "EFECTIVO_REMITO",
  receipt_kind: "REMITO",
  status: "REGISTRADA",
  document_id: null,
  closure_id: null,
  receipt_reference: null,
  customer_name_snapshot: null,
  notes: null,
});

describe("fetchAllCashRows", () => {
  it("includes every movement when the range contains more than 5000 rows", async () => {
    const source = Array.from({ length: 5001 }, (_, index) => makeSale(index));
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      // Simulates a server-side row cap smaller than the requested page.
      data: source.slice(from, Math.min(to + 1, from + 750)),
      error: null,
      count: source.length,
    }));

    const sales = await fetchAllCashRows(fetchPage);
    const report = buildCashTotalsReport(sales, []);

    expect(sales).toHaveLength(5001);
    expect(report.summary.salesCount).toBe(5001);
    expect(report.summary.grossSalesTotal).toBe(5001);
    expect(fetchPage).toHaveBeenCalledTimes(7);
  });

  it("fails instead of returning a silently incomplete report", async () => {
    await expect(fetchAllCashRows(async () => ({
      data: [],
      error: null,
      count: 1,
    }))).rejects.toThrow("quedó incompleta");
  });

  it("fails when an exact count is unavailable", async () => {
    await expect(fetchAllCashRows(async () => ({
      data: [],
      error: null,
      count: null,
    }))).rejects.toThrow("cantidad completa");
  });
});
