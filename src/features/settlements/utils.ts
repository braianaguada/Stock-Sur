import { todayBusinessDateInputValue } from "@/lib/formatters";
import type {
  EditableExpenseLine,
  EditableIncomeLine,
  Settlement,
  SettlementExpenseLine,
  SettlementHeaderForm,
  SettlementIncomeLine,
  SettlementStatus,
  SettlementTotals,
} from "@/features/settlements/types";

export const EMPTY_SETTLEMENT_TOTALS: SettlementTotals = {
  income_cash_total: 0,
  income_other_total: 0,
  income_total: 0,
  expense_cash_total: 0,
  expense_other_total: 0,
  expense_total: 0,
  settlement_total: 0,
};

export const settlementStatusLabel: Record<SettlementStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Presentada",
  RECEIVED: "Recibida",
  CANCELLED: "Anulada",
};

export function isDraftSettlement(status: SettlementStatus | null | undefined) {
  return status === "DRAFT";
}

export function formatSettlementNumber(value: number | null) {
  return value == null ? "Sin numero" : `#${String(value).padStart(5, "0")}`;
}

export function createHeaderForm(settlement?: Settlement | null): SettlementHeaderForm {
  return {
    settlement_date: settlement?.settlement_date ?? todayBusinessDateInputValue(),
    period_from: settlement?.period_from ?? "",
    period_to: settlement?.period_to ?? "",
    prepared_by_name: settlement?.prepared_by_name ?? "",
    notes: settlement?.notes ?? "",
  };
}

export function headerFormToPayload(form: SettlementHeaderForm) {
  return {
    settlement_date: form.settlement_date,
    period_from: optionalText(form.period_from),
    period_to: optionalText(form.period_to),
    prepared_by_name: form.prepared_by_name.trim(),
    notes: optionalText(form.notes),
  };
}

export function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function calculateSettlementTotals(
  incomeLines: Array<Pick<EditableIncomeLine, "cash_amount" | "other_amount">>,
  expenseLines: Array<Pick<EditableExpenseLine, "cash_amount" | "other_amount">>,
): SettlementTotals {
  const incomeCash = incomeLines.reduce((sum, line) => sum + parseMoneyInput(line.cash_amount), 0);
  const incomeOther = incomeLines.reduce((sum, line) => sum + parseMoneyInput(line.other_amount), 0);
  const expenseCash = expenseLines.reduce((sum, line) => sum + parseMoneyInput(line.cash_amount), 0);
  const expenseOther = expenseLines.reduce((sum, line) => sum + parseMoneyInput(line.other_amount), 0);

  return {
    income_cash_total: incomeCash,
    income_other_total: incomeOther,
    income_total: incomeCash + incomeOther,
    expense_cash_total: expenseCash,
    expense_other_total: expenseOther,
    expense_total: expenseCash + expenseOther,
    settlement_total: incomeCash + incomeOther - expenseCash - expenseOther,
  };
}

export function makeIncomeLineDraft(date = todayBusinessDateInputValue()): EditableIncomeLine {
  return {
    id: `new-income-${crypto.randomUUID()}`,
    line_date: date,
    work_order: "",
    receipt_number: "",
    budget_number: "",
    customer_name: "",
    concept: "",
    cash_amount: "0",
    other_amount: "0",
    income_type: "",
  };
}

export function makeExpenseLineDraft(date = todayBusinessDateInputValue()): EditableExpenseLine {
  return {
    id: `new-expense-${crypto.randomUUID()}`,
    line_date: date,
    receipt_number: "",
    supplier_name: "",
    detail: "",
    purchase_order: "",
    cash_amount: "0",
    other_amount: "0",
  };
}

export function incomeLineToForm(line: SettlementIncomeLine): EditableIncomeLine {
  return {
    id: line.id,
    line_date: line.line_date,
    work_order: line.work_order ?? "",
    receipt_number: line.receipt_number ?? "",
    budget_number: line.budget_number ?? "",
    customer_name: line.customer_name ?? "",
    concept: line.concept,
    cash_amount: String(line.cash_amount ?? 0),
    other_amount: String(line.other_amount ?? 0),
    income_type: line.income_type ?? "",
  };
}

export function expenseLineToForm(line: SettlementExpenseLine): EditableExpenseLine {
  return {
    id: line.id,
    line_date: line.line_date,
    receipt_number: line.receipt_number ?? "",
    supplier_name: line.supplier_name ?? "",
    detail: line.detail,
    purchase_order: line.purchase_order ?? "",
    cash_amount: String(line.cash_amount ?? 0),
    other_amount: String(line.other_amount ?? 0),
  };
}

export function isExistingLineId(id: string) {
  return !id.startsWith("new-");
}

export function normalizeTotals(value: Partial<SettlementTotals> | null | undefined): SettlementTotals {
  return {
    income_cash_total: Number(value?.income_cash_total ?? 0),
    income_other_total: Number(value?.income_other_total ?? 0),
    income_total: Number(value?.income_total ?? 0),
    expense_cash_total: Number(value?.expense_cash_total ?? 0),
    expense_other_total: Number(value?.expense_other_total ?? 0),
    expense_total: Number(value?.expense_total ?? 0),
    settlement_total: Number(value?.settlement_total ?? 0),
  };
}
