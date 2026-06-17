export type SettlementStatus = "DRAFT" | "SUBMITTED" | "RECEIVED" | "CANCELLED";

export type Settlement = {
  id: string;
  company_id: string;
  settlement_number: number | null;
  settlement_date: string;
  period_from: string | null;
  period_to: string | null;
  status: SettlementStatus;
  prepared_by_name: string;
  received_by_name: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SettlementIncomeLine = {
  id: string;
  company_id: string;
  settlement_id: string;
  line_date: string;
  work_order: string | null;
  receipt_number: string | null;
  budget_number: string | null;
  customer_name: string | null;
  concept: string;
  cash_amount: number | string;
  other_amount: number | string;
  income_type: string | null;
  display_order: number;
};

export type SettlementExpenseLine = {
  id: string;
  company_id: string;
  settlement_id: string;
  line_date: string;
  receipt_number: string | null;
  supplier_name: string | null;
  detail: string;
  purchase_order: string | null;
  cash_amount: number | string;
  other_amount: number | string;
  display_order: number;
};

export type SettlementTotals = {
  income_cash_total: number;
  income_other_total: number;
  income_total: number;
  expense_cash_total: number;
  expense_other_total: number;
  expense_total: number;
  settlement_total: number;
};

export type SettlementListRow = Settlement & {
  totals: SettlementTotals;
};

export type SettlementHeaderForm = {
  settlement_date: string;
  period_from: string;
  period_to: string;
  prepared_by_name: string;
  notes: string;
};

export type EditableIncomeLine = {
  id: string;
  line_date: string;
  work_order: string;
  receipt_number: string;
  budget_number: string;
  customer_name: string;
  concept: string;
  cash_amount: string;
  other_amount: string;
  income_type: string;
};

export type EditableExpenseLine = {
  id: string;
  line_date: string;
  receipt_number: string;
  supplier_name: string;
  detail: string;
  purchase_order: string;
  cash_amount: string;
  other_amount: string;
};
