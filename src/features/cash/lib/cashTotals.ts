import type { CashAdjustmentRow, CashExpenseRow, CashSaleRow, PaymentMethod } from "../types";

export type CashTotalsPeriod = "day" | "week" | "month" | "range";

export type CashTotalsRange = {
  from: string;
  to: string;
};

export type CashDailyTotal = {
  businessDate: string;
  salesCount: number;
  pendingReceiptCount: number;
  grossSalesTotal: number;
  cashTotal: number;
  cashRemitoTotal: number;
  cashFacturableTotal: number;
  servicesRemitoTotal: number;
  transferTotal: number;
  mercadoPagoTotal: number;
  cardTotal: number;
  accountCurrentTotal: number;
  otherPaymentTotal: number;
  expensesCashTotal: number;
  expensesNonCashTotal: number;
  expensesTotal: number;
  adjustmentsTotal: number;
  returnsTotal: number;
  netCashTotal: number;
  netTotal: number;
};

export type CashTotalsReport = {
  days: CashDailyTotal[];
  summary: CashDailyTotal;
};

const emptyDailyTotal = (businessDate: string): CashDailyTotal => ({
  businessDate,
  salesCount: 0,
  pendingReceiptCount: 0,
  grossSalesTotal: 0,
  cashTotal: 0,
  cashRemitoTotal: 0,
  cashFacturableTotal: 0,
  servicesRemitoTotal: 0,
  transferTotal: 0,
  mercadoPagoTotal: 0,
  cardTotal: 0,
  accountCurrentTotal: 0,
  otherPaymentTotal: 0,
  expensesCashTotal: 0,
  expensesNonCashTotal: 0,
  expensesTotal: 0,
  adjustmentsTotal: 0,
  returnsTotal: 0,
  netCashTotal: 0,
  netTotal: 0,
});

export const CASH_TOTALS_SUMMARY_DATE = "__summary__";

function addAmountForPaymentMethod(day: CashDailyTotal, paymentMethod: PaymentMethod, amount: number) {
  if (paymentMethod === "EFECTIVO" || paymentMethod === "EFECTIVO_REMITO") {
    day.cashTotal += amount;
    day.cashRemitoTotal += amount;
    return;
  }

  if (paymentMethod === "EFECTIVO_FACTURABLE") {
    day.cashTotal += amount;
    day.cashFacturableTotal += amount;
    return;
  }

  if (paymentMethod === "SERVICIOS_REMITO") {
    day.servicesRemitoTotal += amount;
    return;
  }

  if (paymentMethod === "POINT") {
    day.mercadoPagoTotal += amount;
    day.cardTotal += amount;
    return;
  }

  if (paymentMethod === "TRANSFERENCIA") {
    day.transferTotal += amount;
    return;
  }

  if (paymentMethod === "CUENTA_CORRIENTE") {
    day.accountCurrentTotal += amount;
    return;
  }

  day.otherPaymentTotal += amount;
}

function finalizeDay(day: CashDailyTotal) {
  day.expensesTotal = day.expensesCashTotal + day.expensesNonCashTotal;
  day.netCashTotal = day.cashTotal - day.expensesCashTotal;
  day.netTotal = day.grossSalesTotal - day.expensesTotal;
  return day;
}

function addDayIntoSummary(summary: CashDailyTotal, day: CashDailyTotal) {
  summary.salesCount += day.salesCount;
  summary.pendingReceiptCount += day.pendingReceiptCount;
  summary.grossSalesTotal += day.grossSalesTotal;
  summary.cashTotal += day.cashTotal;
  summary.cashRemitoTotal += day.cashRemitoTotal;
  summary.cashFacturableTotal += day.cashFacturableTotal;
  summary.servicesRemitoTotal += day.servicesRemitoTotal;
  summary.transferTotal += day.transferTotal;
  summary.mercadoPagoTotal += day.mercadoPagoTotal;
  summary.cardTotal += day.cardTotal;
  summary.accountCurrentTotal += day.accountCurrentTotal;
  summary.otherPaymentTotal += day.otherPaymentTotal;
  summary.expensesCashTotal += day.expensesCashTotal;
  summary.expensesNonCashTotal += day.expensesNonCashTotal;
  summary.expensesTotal += day.expensesTotal;
  summary.adjustmentsTotal += day.adjustmentsTotal;
  summary.returnsTotal += day.returnsTotal;
  summary.netCashTotal += day.netCashTotal;
  summary.netTotal += day.netTotal;
}

export function buildCashTotalsReport(
  sales: CashSaleRow[],
  expenses: CashExpenseRow[],
  adjustments: CashAdjustmentRow[] = [],
): CashTotalsReport {
  const daysByDate = new Map<string, CashDailyTotal>();
  const getDay = (businessDate: string) => {
    const existing = daysByDate.get(businessDate);
    if (existing) return existing;
    const next = emptyDailyTotal(businessDate);
    daysByDate.set(businessDate, next);
    return next;
  };

  for (const sale of sales) {
    const day = getDay(sale.business_date);
    if (sale.status === "PENDIENTE_COMPROBANTE") {
      day.pendingReceiptCount += 1;
    }
    if (sale.status === "ANULADA") continue;

    const amount = Number(sale.amount_total);
    if (!Number.isFinite(amount)) continue;
    day.salesCount += 1;
    day.grossSalesTotal += amount;
    addAmountForPaymentMethod(day, sale.payment_method, amount);
  }

  for (const expense of expenses) {
    const day = getDay(expense.business_date);
    if (expense.cancelled_at) continue;

    const amount = Number(expense.amount_total);
    if (!Number.isFinite(amount)) continue;
    if (expense.expense_kind === "CAJA") {
      day.expensesCashTotal += amount;
    } else {
      day.expensesNonCashTotal += amount;
    }
  }

  for (const adjustment of adjustments) {
    const day = getDay(adjustment.business_date);
    if (adjustment.cancelled_at) continue;

    const signedAmount = Number(adjustment.signed_amount);
    const amount = Number(adjustment.amount_total);
    if (!Number.isFinite(signedAmount) || !Number.isFinite(amount)) continue;
    day.adjustmentsTotal += signedAmount;
    day.returnsTotal += amount;
    day.grossSalesTotal += signedAmount;
    addAmountForPaymentMethod(day, adjustment.payment_method, signedAmount);
  }

  const days = Array.from(daysByDate.values())
    .map(finalizeDay)
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate));
  const summary = emptyDailyTotal(CASH_TOTALS_SUMMARY_DATE);
  for (const day of days) {
    addDayIntoSummary(summary, day);
  }
  return { days, summary };
}

function parseDateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toUtcDate(value: string) {
  const { year, month, day } = parseDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date);
}

export function getCashTotalsRange(period: CashTotalsPeriod, anchorDate: string, customRange?: CashTotalsRange): CashTotalsRange {
  if (period === "range") {
    const from = customRange?.from || anchorDate;
    const to = customRange?.to || from;
    return from <= to ? { from, to } : { from: to, to: from };
  }

  if (period === "day") {
    return { from: anchorDate, to: anchorDate };
  }

  if (period === "week") {
    const date = toUtcDate(anchorDate);
    const dayOfWeek = date.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const from = addDays(anchorDate, -daysSinceMonday);
    return { from, to: addDays(from, 6) };
  }

  const { year, month } = parseDateParts(anchorDate);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from, to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
}
