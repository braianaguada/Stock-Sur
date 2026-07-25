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
  rpc(fn: "save_settlement_draft", args: SaveSettlementDraftRpcArgs): DbResponse<Settlement>;
  rpc(fn: "submit_settlement", args: { p_settlement_id: string }): DbResponse<Settlement>;
  rpc(fn: "receive_settlement", args: { p_settlement_id: string; p_received_by_name: string }): DbResponse<Settlement>;
  rpc(fn: "cancel_settlement", args: { p_settlement_id: string }): DbResponse<Settlement>;
  from(table: "settlements"): TableClient<Settlement>;
  from(table: "settlement_income_lines"): TableClient<SettlementIncomeLine>;
  from(table: "settlement_expense_lines"): TableClient<SettlementExpenseLine>;
  from(table: "profiles"): TableClient<{ full_name: string | null }>;
};

const db = supabase as unknown as SettlementRpc;

export type SaveSettlementDraftRpcArgs = {
  p_settlement_id: string;
  p_header: ReturnType<typeof headerFormToPayload>;
  p_income_lines: Array<ReturnType<typeof incomeLinePayload>>;
  p_expense_lines: Array<ReturnType<typeof expenseLinePayload>>;
};

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

export async function fetchSettlementPreparerName(userId: string) {
  const { data, error } = await db
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.full_name?.trim() ?? "";
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

export function buildSaveSettlementDraftArgs(params: {
  settlementId: string;
  headerForm: SettlementHeaderForm;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
}): SaveSettlementDraftRpcArgs {
  const { settlementId, headerForm, incomeLines, expenseLines } = params;
  return {
    p_settlement_id: settlementId,
    p_header: headerFormToPayload(headerForm),
    p_income_lines: incomeLines.map((line, index) => incomeLinePayload(line, index + 1)),
    p_expense_lines: expenseLines.map((line, index) => expenseLinePayload(line, index + 1)),
  };
}

export async function saveSettlementDraft(params: {
  settlementId: string;
  headerForm: SettlementHeaderForm;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
}) {
  const { data, error } = await db.rpc("save_settlement_draft", buildSaveSettlementDraftArgs(params));
  return assertData(data, error, "No se pudo guardar el borrador.");
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

function incomeLinePayload(line: EditableIncomeLine, displayOrder: number) {
  return {
    line_date: line.line_date,
    work_order: optionalText(line.work_order),
    receipt: optionalText(line.receipt),
    quote: optionalText(line.quote),
    customer_name: optionalText(line.customer_name),
    concept: line.concept.trim(),
    cash_amount: parseMoneyInput(line.cash_amount),
    other_amount: parseMoneyInput(line.other_amount),
    income_type: optionalText(line.income_type),
    display_order: displayOrder,
  };
}

function expenseLinePayload(line: EditableExpenseLine, displayOrder: number) {
  return {
    line_date: line.line_date,
    receipt: optionalText(line.receipt),
    supplier_name: optionalText(line.supplier_name),
    detail: line.detail.trim(),
    purchase_order: optionalText(line.purchase_order),
    cash_amount: parseMoneyInput(line.cash_amount),
    other_amount: parseMoneyInput(line.other_amount),
    display_order: displayOrder,
  };
}
