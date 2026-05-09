import { describe, expect, it } from "vitest";
import type { CashExpenseRow, CashSaleRow } from "./types";
import {
  buildCashExpenseSummary,
  buildCashSummary,
  shouldAutoCloseCashClosure,
  validateCashExpenseForm,
} from "./utils";

describe("cash auto close", () => {
  it("closes once the configured time is reached", () => {
    const result = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 31,
      closureId: "closure-1",
      triggeredKey: null,
    });

    expect(result).toEqual({
      shouldClose: true,
      nextTriggeredKey: "2026-05-05:closure-1:18:30",
    });
  });

  it("does not close before the configured time or twice for the same closure", () => {
    const first = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 29,
      closureId: "closure-1",
      triggeredKey: null,
    });

    const second = shouldAutoCloseCashClosure({
      enabled: true,
      configuredTime: "18:30",
      businessDate: "2026-05-05",
      todayBusinessDate: "2026-05-05",
      currentHour: 18,
      currentMinute: 31,
      closureId: "closure-1",
      triggeredKey: "2026-05-05:closure-1:18:30",
    });

    expect(first.shouldClose).toBe(false);
    expect(second.shouldClose).toBe(false);
  });
});

const baseExpense = (overrides: Partial<CashExpenseRow>): CashExpenseRow => ({
  id: "expense-1",
  company_id: "company-1",
  business_date: "2026-05-08",
  spent_at: "2026-05-08T12:00:00.000Z",
  expense_kind: "CAJA",
  category: "OTROS",
  amount_total: 100,
  description: "Gasto",
  has_receipt: false,
  receipt_reference: null,
  notes: null,
  closure_id: null,
  created_by: "user-1",
  created_at: "2026-05-08T12:00:00.000Z",
  updated_at: "2026-05-08T12:00:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  ...overrides,
});

const baseSale = (overrides: Partial<CashSaleRow>): CashSaleRow => ({
  id: "sale-1",
  sold_at: "2026-05-08T12:00:00.000Z",
  business_date: "2026-05-08",
  amount_total: 1000,
  payment_method: "EFECTIVO_REMITO",
  receipt_kind: "REMITO",
  status: "REGISTRADA",
  document_id: null,
  closure_id: null,
  receipt_reference: null,
  customer_name_snapshot: null,
  notes: null,
  ...overrides,
});

describe("cash expenses", () => {
  it("validates positive amount, category and description", () => {
    expect(validateCashExpenseForm({
      businessDate: "2026-05-08",
      category: "",
      description: "Bolsas",
      amount: "10",
      expenseKind: "CAJA",
      hasReceipt: false,
      receiptReference: "",
      notes: "",
    })).toBe("La categoria es obligatoria");

    expect(validateCashExpenseForm({
      businessDate: "2026-05-08",
      category: "INSUMOS",
      description: "",
      amount: "10",
      expenseKind: "CAJA",
      hasReceipt: false,
      receiptReference: "",
      notes: "",
    })).toBe("La descripcion es obligatoria");

    expect(validateCashExpenseForm({
      businessDate: "2026-05-08",
      category: "INSUMOS",
      description: "Bolsas",
      amount: "0",
      expenseKind: "CAJA",
      hasReceipt: false,
      receiptReference: "",
      notes: "",
    })).toBe("El monto debe ser mayor a cero");
  });

  it("sums active expenses and ignores voided ones", () => {
    const summary = buildCashExpenseSummary([
      baseExpense({ amount_total: 120, category: "INSUMOS" }),
      baseExpense({ id: "expense-2", amount_total: 30, expense_kind: "CUENTA_CORRIENTE", category: "ENVIO" }),
      baseExpense({ id: "expense-3", amount_total: 80, cancelled_at: "2026-05-08T13:00:00.000Z", cancelled_by: "user-1" }),
    ]);

    expect(summary.total).toBe(150);
    expect(summary.cash).toBe(120);
    expect(summary.nonCash).toBe(30);
    expect(summary.byCategory.INSUMOS).toBe(120);
  });

  it("reduces expected cash only with cash expenses", () => {
    const summary = buildCashSummary(
      [
        baseSale({ amount_total: 1000, payment_method: "EFECTIVO_REMITO" }),
        baseSale({ id: "sale-2", amount_total: 500, payment_method: "TRANSFERENCIA" }),
      ],
      [
        baseExpense({ amount_total: 200, expense_kind: "CAJA" }),
        baseExpense({ id: "expense-2", amount_total: 90, expense_kind: "CUENTA_CORRIENTE" }),
      ],
    );

    expect(summary.efectivoAntesGastos).toBe(1000);
    expect(summary.gastosEfectivo).toBe(200);
    expect(summary.gastosNoEfectivo).toBe(90);
    expect(summary.efectivoNetoEsperado).toBe(800);
  });
});
