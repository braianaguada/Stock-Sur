import { supabase } from "@/integrations/supabase/client";
import type {
  EditableExpenseLine,
  EditableIncomeLine,
  Settlement,
  SettlementExpenseLine,
  SettlementHeaderForm,
  SettlementIncomeLine,
  SettlementListRow,
  SettlementTotals,
} from "@/features/settlements/types";
import {
  EMPTY_SETTLEMENT_TOTALS,
  headerFormToPayload,
  isExistingLineId,
  normalizeTotals,
  optionalText,
  parseMoneyInput,
} from "@/features/settlements/utils";

type DbError = { message: string };
type DbResponse<T> = PromiseLike<{ data: T | null; error: DbError | null }>;

type SelectQuery<T> = PromiseLike<{ data: T[] | null; error: DbError | null }> & {
  eq: (column: string, value: string | number | null) => SelectQuery<T>;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => SelectQuery<T>;
  limit: (count: number) => SelectQuery<T>;
  single: () => DbResponse<T>;
  maybeSingle: () => DbResponse<T>;
};

type MutationQuery<T> = PromiseLike<{ data: T[] | null; error: DbError | null }> & {
  eq: (column: string, value: string | number | null) => MutationQuery<T>;
  select: (columns?: string) => {
    single: () => DbResponse<T>;
  };
};

type TableClient<T> = {
  select: (columns?: string) => SelectQuery<T>;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
    select: (columns?: string) => {
      single: () => DbResponse<T>;
    };
  };
  update: (values: Record<string, unknown>) => MutationQuery<T>;
  delete: () => MutationQuery<T>;
};

type SettlementRpc = {
  rpc(fn: "get_settlement_totals", args: { p_settlement_id: string }): DbResponse<SettlementTotals[] | SettlementTotals>;
  rpc(fn: "submit_settlement", args: { p_settlement_id: string }): DbResponse<Settlement>;
  rpc(fn: "receive_settlement", args: { p_settlement_id: string; p_received_by_name: string }): DbResponse<Settlement>;
  rpc(fn: "cancel_settlement", args: { p_settlement_id: string }): DbResponse<Settlement>;
  from(table: "settlements"): TableClient<Settlement>;
  from(table: "settlement_income_lines"): TableClient<SettlementIncomeLine>;
  from(table: "settlement_expense_lines"): TableClient<SettlementExpenseLine>;
};

const db = supabase as unknown as SettlementRpc;

function assertData<T>(data: T | null, error: DbError | null, fallbackMessage: string): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error(fallbackMessage);
  return data;
}

function currentUserLabel(email: string | null | undefined) {
  const value = (email ?? "").trim();
  if (!value) return "Usuario";
  return value.includes("@") ? value.slice(0, value.indexOf("@")) : value;
}

export async function fetchSettlements(companyId: string): Promise<SettlementListRow[]> {
  const { data, error } = await db
    .from("settlements")
    .select("*")
    .eq("company_id", companyId)
    .order("settlement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  const settlements = data ?? [];
  const totals = await Promise.all(settlements.map((settlement) => fetchSettlementTotals(settlement.id)));
  return settlements.map((settlement, index) => ({ ...settlement, totals: totals[index] ?? EMPTY_SETTLEMENT_TOTALS }));
}

export async function fetchSettlementDetail(companyId: string, settlementId: string) {
  const { data, error } = await db
    .from("settlements")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", settlementId)
    .maybeSingle();

  return assertData(data, error, "No se encontro la rendicion.");
}

export async function fetchSettlementLines(companyId: string, settlementId: string) {
  const [incomeResult, expenseResult] = await Promise.all([
    db
      .from("settlement_income_lines")
      .select("*")
      .eq("company_id", companyId)
      .eq("settlement_id", settlementId)
      .order("display_order", { ascending: true }),
    db
      .from("settlement_expense_lines")
      .select("*")
      .eq("company_id", companyId)
      .eq("settlement_id", settlementId)
      .order("display_order", { ascending: true }),
  ]);

  if (incomeResult.error) throw new Error(incomeResult.error.message);
  if (expenseResult.error) throw new Error(expenseResult.error.message);

  return {
    incomeLines: incomeResult.data ?? [],
    expenseLines: expenseResult.data ?? [],
  };
}

export async function fetchSettlementTotals(settlementId: string): Promise<SettlementTotals> {
  const { data, error } = await db.rpc("get_settlement_totals", { p_settlement_id: settlementId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeTotals(row);
}

export async function createSettlementDraft(companyId: string, userEmail?: string | null) {
  const { data, error } = await db
    .from("settlements")
    .insert({
      company_id: companyId,
      prepared_by_name: currentUserLabel(userEmail),
    })
    .select("*")
    .single();

  return assertData(data, error, "No se pudo crear la rendicion.");
}

export async function updateSettlementHeader(companyId: string, settlementId: string, form: SettlementHeaderForm) {
  const { data, error } = await db
    .from("settlements")
    .update(headerFormToPayload(form))
    .eq("company_id", companyId)
    .eq("id", settlementId)
    .select("*")
    .single();

  return assertData(data, error, "No se pudo guardar la cabecera.");
}

export async function saveSettlementLines(params: {
  companyId: string;
  settlementId: string;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
  originalIncomeIds: string[];
  originalExpenseIds: string[];
}) {
  const { companyId, settlementId, incomeLines, expenseLines, originalIncomeIds, originalExpenseIds } = params;
  const incomeIds = new Set(incomeLines.filter((line) => isExistingLineId(line.id)).map((line) => line.id));
  const expenseIds = new Set(expenseLines.filter((line) => isExistingLineId(line.id)).map((line) => line.id));

  await Promise.all(originalIncomeIds.filter((id) => !incomeIds.has(id)).map((id) => deleteIncomeLine(companyId, settlementId, id)));
  await Promise.all(originalExpenseIds.filter((id) => !expenseIds.has(id)).map((id) => deleteExpenseLine(companyId, settlementId, id)));

  for (const [index, line] of incomeLines.entries()) {
    const payload = incomeLinePayload(companyId, settlementId, line, index + 1);
    if (isExistingLineId(line.id)) {
      await updateIncomeLine(companyId, settlementId, line.id, payload);
    } else {
      await insertIncomeLine(payload);
    }
  }

  for (const [index, line] of expenseLines.entries()) {
    const payload = expenseLinePayload(companyId, settlementId, line, index + 1);
    if (isExistingLineId(line.id)) {
      await updateExpenseLine(companyId, settlementId, line.id, payload);
    } else {
      await insertExpenseLine(payload);
    }
  }
}

export async function submitSettlement(settlementId: string) {
  const { data, error } = await db.rpc("submit_settlement", { p_settlement_id: settlementId });
  return assertData(data, error, "No se pudo presentar la rendicion.");
}

export async function receiveSettlement(settlementId: string, receivedByName: string) {
  const { data, error } = await db.rpc("receive_settlement", {
    p_settlement_id: settlementId,
    p_received_by_name: receivedByName.trim(),
  });
  return assertData(data, error, "No se pudo recibir la rendicion.");
}

export async function cancelSettlement(settlementId: string) {
  const { data, error } = await db.rpc("cancel_settlement", { p_settlement_id: settlementId });
  return assertData(data, error, "No se pudo anular la rendicion.");
}

function incomeLinePayload(companyId: string, settlementId: string, line: EditableIncomeLine, displayOrder: number) {
  return {
    company_id: companyId,
    settlement_id: settlementId,
    line_date: line.line_date,
    work_order: optionalText(line.work_order),
    receipt_number: optionalText(line.receipt_number),
    budget_number: optionalText(line.budget_number),
    customer_name: optionalText(line.customer_name),
    concept: line.concept.trim(),
    cash_amount: parseMoneyInput(line.cash_amount),
    other_amount: parseMoneyInput(line.other_amount),
    income_type: optionalText(line.income_type),
    display_order: displayOrder,
  };
}

function expenseLinePayload(companyId: string, settlementId: string, line: EditableExpenseLine, displayOrder: number) {
  return {
    company_id: companyId,
    settlement_id: settlementId,
    line_date: line.line_date,
    receipt_number: optionalText(line.receipt_number),
    supplier_name: optionalText(line.supplier_name),
    detail: line.detail.trim(),
    purchase_order: optionalText(line.purchase_order),
    cash_amount: parseMoneyInput(line.cash_amount),
    other_amount: parseMoneyInput(line.other_amount),
    display_order: displayOrder,
  };
}

async function insertIncomeLine(payload: Record<string, unknown>) {
  const { error } = await db.from("settlement_income_lines").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
}

async function updateIncomeLine(companyId: string, settlementId: string, lineId: string, payload: Record<string, unknown>) {
  const { error } = await db
    .from("settlement_income_lines")
    .update(payload)
    .eq("company_id", companyId)
    .eq("settlement_id", settlementId)
    .eq("id", lineId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

async function deleteIncomeLine(companyId: string, settlementId: string, lineId: string) {
  const { error } = await db
    .from("settlement_income_lines")
    .delete()
    .eq("company_id", companyId)
    .eq("settlement_id", settlementId)
    .eq("id", lineId);
  if (error) throw new Error(error.message);
}

async function insertExpenseLine(payload: Record<string, unknown>) {
  const { error } = await db.from("settlement_expense_lines").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
}

async function updateExpenseLine(companyId: string, settlementId: string, lineId: string, payload: Record<string, unknown>) {
  const { error } = await db
    .from("settlement_expense_lines")
    .update(payload)
    .eq("company_id", companyId)
    .eq("settlement_id", settlementId)
    .eq("id", lineId)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

async function deleteExpenseLine(companyId: string, settlementId: string, lineId: string) {
  const { error } = await db
    .from("settlement_expense_lines")
    .delete()
    .eq("company_id", companyId)
    .eq("settlement_id", settlementId)
    .eq("id", lineId);
  if (error) throw new Error(error.message);
}
