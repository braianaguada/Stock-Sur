import { describe, expect, it } from "vitest";
import type { CashExpenseRow, CashSaleRow } from "../types";
import { buildCashTotalsReport, getCashTotalsRange } from "./cashTotals";

const baseSale = (overrides: Partial<CashSaleRow> = {}): CashSaleRow => ({
  id: "sale-1",
  sold_at: "2026-05-09T15:00:00.000Z",
  business_date: "2026-05-09",
  amount_total: 1000,
  payment_method: "EFECTIVO_REMITO",
  receipt_kind: "REMITO",
  status: "REGISTRADA",
  document_id: null,
  closure_id: null,
  receipt_reference: null,
  customer_name_snapshot: "Cliente",
  notes: null,
  ...overrides,
});

const baseExpense = (overrides: Partial<CashExpenseRow> = {}): CashExpenseRow => ({
  id: "expense-1",
  company_id: "company-1",
  business_date: "2026-05-09",
  spent_at: "2026-05-09T16:00:00.000Z",
  expense_kind: "CAJA",
  category: "OTROS",
  amount_total: 100,
  description: "Gasto",
  has_receipt: false,
  receipt_reference: null,
  notes: null,
  closure_id: null,
  created_by: "user-1",
  created_at: "2026-05-09T16:00:00.000Z",
  updated_at: "2026-05-09T16:00:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  ...overrides,
});

describe("cash totals report", () => {
  it("excludes cancelled sales and cancelled expenses", () => {
    const report = buildCashTotalsReport(
      [
        baseSale({ amount_total: 1000 }),
        baseSale({ id: "sale-2", amount_total: 500, status: "ANULADA" }),
      ],
      [
        baseExpense({ amount_total: 100 }),
        baseExpense({ id: "expense-2", amount_total: 40, cancelled_at: "2026-05-09T17:00:00.000Z" }),
      ],
    );

    expect(report.summary.grossSalesTotal).toBe(1000);
    expect(report.summary.expensesTotal).toBe(100);
  });

  it("subtracts cash expenses from net cash and keeps non-cash expenses outside physical cash", () => {
    const report = buildCashTotalsReport(
      [
        baseSale({ amount_total: 1000, payment_method: "EFECTIVO_REMITO" }),
        baseSale({ id: "sale-2", amount_total: 500, payment_method: "TRANSFERENCIA" }),
      ],
      [
        baseExpense({ amount_total: 200, expense_kind: "CAJA" }),
        baseExpense({ id: "expense-2", amount_total: 90, expense_kind: "CUENTA_CORRIENTE" }),
      ],
    );

    expect(report.summary.cashTotal).toBe(1000);
    expect(report.summary.expensesCashTotal).toBe(200);
    expect(report.summary.expensesNonCashTotal).toBe(90);
    expect(report.summary.netCashTotal).toBe(800);
    expect(report.summary.netTotal).toBe(1210);
  });

  it("separates account current and groups totals by day", () => {
    const report = buildCashTotalsReport(
      [
        baseSale({ amount_total: 1000, payment_method: "CUENTA_CORRIENTE" }),
        baseSale({ id: "sale-2", business_date: "2026-05-10", amount_total: 300, payment_method: "POINT" }),
      ],
      [baseExpense({ business_date: "2026-05-10", amount_total: 50 })],
    );

    expect(report.days).toHaveLength(2);
    expect(report.days[0].businessDate).toBe("2026-05-10");
    expect(report.summary.accountCurrentTotal).toBe(1000);
    expect(report.summary.mercadoPagoTotal).toBe(300);
    expect(report.summary.grossSalesTotal).toBe(1300);
  });

  it("returns empty days and zero summary when there is no data", () => {
    const report = buildCashTotalsReport([], []);
    expect(report.days).toEqual([]);
    expect(report.summary.grossSalesTotal).toBe(0);
    expect(report.summary.netCashTotal).toBe(0);
  });

  it("calculates day, week, month and normalized custom ranges", () => {
    expect(getCashTotalsRange("day", "2026-05-09")).toEqual({ from: "2026-05-09", to: "2026-05-09" });
    expect(getCashTotalsRange("week", "2026-05-09")).toEqual({ from: "2026-05-04", to: "2026-05-10" });
    expect(getCashTotalsRange("month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(getCashTotalsRange("range", "2026-05-09", { from: "2026-05-20", to: "2026-05-10" })).toEqual({
      from: "2026-05-10",
      to: "2026-05-20",
    });
  });
});
