export type AccountEntryType = "DEBIT" | "CREDIT";
export type AccountOriginType = "DOCUMENT" | "CASH_SALE" | "MANUAL";
export type AccountStatementStatus = "pending" | "partial" | "paid" | "overdue" | "payment";

export type AccountStatementFilters = {
  customerId?: string | null;
  from?: string | null;
  to?: string | null;
  status?: AccountStatementStatus | "all";
  search?: string | null;
};

export type AccountStatementSource = {
  id: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_is_occasional?: boolean | null;
  customer_account_due_days?: number | null;
  entry_type: AccountEntryType;
  origin_type: AccountOriginType;
  origin_id: string;
  document_id: string | null;
  cash_sale_id: string | null;
  amount: number;
  business_date: string;
  description: string | null;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  document?: {
    id: string;
    doc_type: string | null;
    point_of_sale: number | null;
    document_number: number | null;
    external_invoice_number: string | null;
    issue_date: string | null;
  } | null;
  cashSale?: {
    id: string;
    receipt_kind: string | null;
    receipt_reference: string | null;
    business_date: string | null;
  } | null;
};

export type AccountStatementRow = AccountStatementSource & {
  due_date: string | null;
  reference: string;
  origin_label: string;
  debit: number;
  credit: number;
  running_balance: number;
  status: AccountStatementStatus;
};

export type AccountStatementSummary = {
  balance: number;
  overdueDebt: number;
  notDueDebt: number;
  periodPayments: number;
  movementsCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function asDateOnly(value: string): string {
  return value.slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${asDateOnly(date)}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getMetadataText(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getMetadataNumber(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function formatDocumentReference(document: AccountStatementSource["document"]): string | null {
  if (!document) return null;
  const invoice = document.external_invoice_number?.trim();
  if (invoice) return `Factura ${invoice}`;
  if (document.point_of_sale != null && document.document_number != null) {
    return `${document.doc_type ?? "Documento"} ${String(document.point_of_sale).padStart(4, "0")}-${String(document.document_number).padStart(8, "0")}`;
  }
  return document.doc_type ?? "Documento";
}

function resolveReference(entry: AccountStatementSource): string {
  const documentReference = formatDocumentReference(entry.document);
  if (documentReference) return documentReference;
  const metadataReference =
    getMetadataText(entry.metadata, "reference_number") ??
    getMetadataText(entry.metadata, "reference") ??
    getMetadataText(entry.metadata, "receipt_reference");
  if (metadataReference) return metadataReference;
  if (entry.cashSale?.receipt_reference?.trim()) return entry.cashSale.receipt_reference.trim();
  return entry.origin_type === "MANUAL" ? "Cobro manual" : entry.origin_id;
}

function resolveDueDate(entry: AccountStatementSource, defaultDebitDays = 30): string | null {
  if (entry.entry_type !== "DEBIT") return null;
  const explicitDueDate = getMetadataText(entry.metadata, "due_date");
  if (explicitDueDate) return asDateOnly(explicitDueDate);
  const paymentTermDays =
    getMetadataNumber(entry.metadata, "payment_term_days")
    ?? entry.customer_account_due_days
    ?? defaultDebitDays;
  return addDays(entry.document?.issue_date ?? entry.business_date, paymentTermDays);
}

export function buildAccountStatement(
  entries: AccountStatementSource[],
  filters: AccountStatementFilters = {},
  today = new Date().toISOString().slice(0, 10),
): { rows: AccountStatementRow[]; summary: AccountStatementSummary } {
  const validEntries = entries
    .filter((entry) => entry.customer_id && !entry.customer_is_occasional)
    .filter((entry) => !filters.customerId || entry.customer_id === filters.customerId)
    .sort((a, b) => {
      const byDate = a.business_date.localeCompare(b.business_date);
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });

  const totalCredits = validEntries.reduce((sum, entry) => sum + (entry.entry_type === "CREDIT" ? entry.amount : 0), 0);
  let runningBalance = 0;
  const rows = validEntries.map<AccountStatementRow>((entry) => {
    const debit = entry.entry_type === "DEBIT" ? entry.amount : 0;
    const credit = entry.entry_type === "CREDIT" ? entry.amount : 0;
    runningBalance += debit - credit;
    const dueDate = resolveDueDate(entry);
    const originLabel = entry.origin_type === "DOCUMENT" ? "Documento" : entry.origin_type === "CASH_SALE" ? "Caja" : "Manual";
    const reference = resolveReference(entry);
    const status =
      entry.entry_type === "CREDIT"
        ? "payment"
        : runningBalance <= 0
          ? "paid"
          : dueDate && dueDate < today
            ? "overdue"
            : totalCredits > 0
            ? "partial"
            : "pending";

    return {
      ...entry,
      due_date: dueDate,
      reference,
      origin_label: originLabel,
      debit,
      credit,
      running_balance: runningBalance,
      status,
    };
  });

  const search = filters.search?.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filters.from && row.business_date < filters.from) return false;
    if (filters.to && row.business_date > filters.to) return false;
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (search) {
      const haystack = [row.customer_name, row.reference, row.description, row.notes, row.origin_label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const balance = rows.at(-1)?.running_balance ?? 0;
  const hasDebt = balance > 0;
  const summary = filteredRows.reduce<AccountStatementSummary>(
    (current, row) => ({
      balance,
      overdueDebt: current.overdueDebt + (hasDebt && row.status === "overdue" ? row.debit : 0),
      notDueDebt: current.notDueDebt + (hasDebt && row.entry_type === "DEBIT" && row.status !== "overdue" && row.status !== "paid" ? row.debit : 0),
      periodPayments: current.periodPayments + row.credit,
      movementsCount: current.movementsCount + 1,
    }),
    { balance, overdueDebt: 0, notDueDebt: 0, periodPayments: 0, movementsCount: 0 },
  );

  return { rows: filteredRows.reverse(), summary };
}

function daysUntil(date: string | null, today = new Date().toISOString().slice(0, 10)): number | null {
  if (!date) return null;
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS);
}
