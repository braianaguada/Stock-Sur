import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchAllPagesByChunks } from "@/lib/supabase-pagination";
import type { CashSaleRow, PaymentMethod } from "./types";

export const DAILY_REPORT_HEADERS = ["TIPO", "LETRA", "P.VTA", "N°", "IMPORTE", "F.PAGO"];
export type ReportRow = [string, string, number | "", number | "", number, string];
type Sale = Pick<CashSaleRow, "id" | "document_id" | "sold_at" | "amount_total" | "payment_method" | "receipt_kind" | "receipt_reference" | "status">;
type Document = { id: string; document_number: number | null; external_invoice_number: string | null; external_invoice_status: string | null };
type Expense = { id: string; spent_at: string; amount_total: number; expense_kind: string; cancelled_at: string | null };
type Adjustment = { id: string; occurred_at: string; document_id: string; signed_amount: number; cancelled_at: string | null };
const paymentLabels: Record<PaymentMethod, string> = {
  EFECTIVO: "EFECT REM", EFECTIVO_REMITO: "EFECT REM", EFECTIVO_FACTURABLE: "EFECT FACT",
  SERVICIOS_REMITO: "SERVICIOS /REMITO", POINT: "MP. POINT", TRANSFERENCIA: "TRANSF/BANCOS", CUENTA_CORRIENTE: "CTA CTE",
};

export function buildDailyReport(sales: Sale[], expenses: Expense[], adjustments: Adjustment[], documents: Document[]): ReportRow[] {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const byInvoice = new Map(documents.filter((doc) => doc.external_invoice_status === "ACTIVE" && doc.external_invoice_number)
    .map((doc) => [doc.external_invoice_number!.trim(), doc]));
  const entries: { at: string; id: string; row: ReportRow }[] = [];
  for (const sale of sales) {
    if (sale.status === "ANULADA") continue;
    const doc = byId.get(sale.document_id ?? "") ?? (sale.receipt_kind === "FACTURA" ? byInvoice.get(sale.receipt_reference?.trim() ?? "") : undefined);
    const invoiceA = doc?.external_invoice_status === "ACTIVE" && Boolean(doc.external_invoice_number);
    const remito = !invoiceA && ["EFECTIVO", "EFECTIVO_REMITO", "SERVICIOS_REMITO"].includes(sale.payment_method);
    const invoiceNumber = invoiceA ? Number(doc?.external_invoice_number?.split(/[-\s]/).at(-1)) : NaN;
    entries.push({ at: sale.sold_at, id: sale.id, row: [remito ? "REMITO" : "FACTURA", remito ? "X" : invoiceA ? "A" : "B", remito ? 7 : 9,
      remito ? doc?.document_number ?? "" : Number.isFinite(invoiceNumber) ? invoiceNumber : "", Number(sale.amount_total), paymentLabels[sale.payment_method]] });
  }
  for (const expense of expenses) {
    if (!expense.cancelled_at) entries.push({ at: expense.spent_at, id: expense.id, row: ["GASTO", "", "", "", -Number(expense.amount_total), expense.expense_kind === "CUENTA_CORRIENTE" ? "CTA CTE" : "EFECT REM"] });
  }
  for (const adjustment of adjustments) {
    if (!adjustment.cancelled_at) entries.push({ at: adjustment.occurred_at, id: adjustment.id, row: ["REMITO", "X", 7, byId.get(adjustment.document_id)?.document_number ?? "", Number(adjustment.signed_amount), "SERVICIOS /REMITO"] });
  }
  return entries.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).map(({ row }) => row);
}

export function dailyReportTsv(rows: ReportRow[]) {
  return rows.map((row) => row.map((value, index) => index === 4 ? Number(value).toFixed(2).replace(".", ",") : value).join("\t")).join("\n");
}

export function dailyReportHtml(rows: ReportRow[]) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<table style="border-collapse:collapse">${dailyReportTsv(rows).split("\n").map((row) => `<tr>${row.split("\t").map((value) => `<td style="border:1px solid #000">${escape(value)}</td>`).join("")}</tr>`).join("")}</table>`;
}

export async function loadDailyReport(companyId: string, date: string) {
  const [sales, expenses, adjustments] = await Promise.all([
    fetchAllPages(() => supabase.from("cash_sales").select("id,document_id,sold_at,amount_total,payment_method,receipt_kind,receipt_reference,status").eq("company_id", companyId).eq("business_date", date).order("id"), 500),
    fetchAllPages(() => supabase.from("cash_expenses").select("id,spent_at,amount_total,expense_kind,cancelled_at").eq("company_id", companyId).eq("business_date", date).order("id"), 500),
    fetchAllPages(() => supabase.from("cash_adjustments").select("id,occurred_at,document_id,signed_amount,cancelled_at").eq("company_id", companyId).eq("business_date", date).order("id"), 500),
  ]);
  const ids = [...new Set([...sales.map((row) => row.document_id), ...adjustments.map((row) => row.document_id)].filter((id): id is string => Boolean(id)))];
  const documents = await fetchAllPagesByChunks(ids, (chunk) => supabase.from("documents").select("id,document_number,external_invoice_number,external_invoice_status").eq("company_id", companyId).in("id", chunk).order("id"), 100, 500);
  const references = [...new Set(sales.filter((sale) => !sale.document_id && sale.receipt_kind === "FACTURA")
    .map((sale) => sale.receipt_reference?.trim()).filter((value): value is string => Boolean(value)))];
  const invoicedDocuments = await fetchAllPagesByChunks(references, (chunk) => supabase.from("documents")
    .select("id,document_number,external_invoice_number,external_invoice_status").eq("company_id", companyId)
    .eq("external_invoice_status", "ACTIVE").in("external_invoice_number", chunk).order("id"), 100, 500);
  return buildDailyReport(sales as Sale[], expenses, adjustments, [...documents, ...invoicedDocuments]);
}
