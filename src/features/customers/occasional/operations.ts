import type { BillingDocumentRow } from "@/features/billing/types";
import type { CashSaleRow, PaymentMethod, RemitoOption } from "@/features/cash/types";

export type OccasionalFiscalStatus =
  | "PENDING_INVOICE_B"
  | "DRAFT_BILLING"
  | "INVOICE_B_AUTHORIZED"
  | "CREDIT_NOTE_B_AUTHORIZED"
  | "REJECTED_BILLING"
  | "CANCELLED"
  | "UNKNOWN";

export type OccasionalClosureStatus = "PENDING_CLOSURE" | "IN_CLOSED_CASH" | "WITHOUT_CASH_SALE";

export type OccasionalOperation = {
  id: string;
  date: string;
  remito: RemitoOption;
  sale: CashSaleRow | null;
  invoiceB: BillingDocumentRow | null;
  creditNoteB: BillingDocumentRow | null;
  fiscalStatus: OccasionalFiscalStatus;
  closureStatus: OccasionalClosureStatus;
  amount: number;
};

export type OccasionalOperationFilters = {
  search: string;
  paymentMethod: PaymentMethod | "ALL";
  fiscalStatus: OccasionalFiscalStatus | "ALL";
  closureStatus: OccasionalClosureStatus | "ALL";
};

export type OccasionalTotals = {
  operationsCount: number;
  remitosCount: number;
  cashSalesCount: number;
  totalAmount: number;
  authorizedInvoiceBTotal: number;
  authorizedCreditNoteBTotal: number;
  pendingInvoiceBTotal: number;
  netFiscalTotal: number;
  invoiceBAuthorizedCount: number;
  creditNoteBAuthorizedCount: number;
  pendingInvoiceBCount: number;
  draftBillingCount: number;
  rejectedBillingCount: number;
  electronicPendingCount: number;
  byPaymentMethod: Partial<Record<PaymentMethod | "SIN_VENTA", number>>;
};

const DRAFT_STATUSES = new Set<BillingDocumentRow["fiscal_status"]>([
  "DRAFT",
  "BLOCKED",
  "READY_TO_AUTHORIZE",
  "AUTHORIZING",
]);

const ELECTRONIC_PAYMENT_METHODS = new Set<PaymentMethod>(["POINT", "TRANSFERENCIA", "EFECTIVO_FACTURABLE"]);

function moneyValue(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function latestDocument(documents: BillingDocumentRow[]) {
  return [...documents].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] ?? null;
}

export function resolveOccasionalFiscalStatus(params: {
  remito: Pick<RemitoOption, "status">;
  sale: Pick<CashSaleRow, "status"> | null;
  invoiceB: BillingDocumentRow | null;
  creditNoteB: BillingDocumentRow | null;
}): OccasionalFiscalStatus {
  const { remito, sale, invoiceB, creditNoteB } = params;

  if (remito.status === "ANULADO" || sale?.status === "ANULADA") return "CANCELLED";
  if (creditNoteB?.invoice_type === "NOTA_CREDITO_B" && creditNoteB.fiscal_status === "AUTHORIZED") return "CREDIT_NOTE_B_AUTHORIZED";
  if (invoiceB?.invoice_type === "FACTURA_B" && invoiceB.fiscal_status === "AUTHORIZED") return "INVOICE_B_AUTHORIZED";
  if (invoiceB?.invoice_type === "FACTURA_B" && invoiceB.fiscal_status === "REJECTED") return "REJECTED_BILLING";
  if (invoiceB?.invoice_type === "FACTURA_B" && DRAFT_STATUSES.has(invoiceB.fiscal_status)) return "DRAFT_BILLING";
  if (sale && sale.status !== "ANULADA" && sale.receipt_kind === "REMITO") return "PENDING_INVOICE_B";
  return "UNKNOWN";
}

export function buildOccasionalOperations(params: {
  remitos: RemitoOption[];
  sales: CashSaleRow[];
  billingDocuments: BillingDocumentRow[];
}) {
  const salesByDocumentId = new Map(params.sales.filter((sale) => sale.document_id).map((sale) => [sale.document_id, sale]));
  const invoicesBySaleId = new Map<string, BillingDocumentRow[]>();
  const invoicesByRemitoId = new Map<string, BillingDocumentRow[]>();
  const creditNotesByInvoiceId = new Map<string, BillingDocumentRow[]>();
  const creditNotesByRemitoId = new Map<string, BillingDocumentRow[]>();

  for (const document of params.billingDocuments) {
    if (document.invoice_type === "FACTURA_B" && document.document_kind === "INVOICE") {
      const sourceBucket = invoicesBySaleId.get(document.source_id) ?? [];
      sourceBucket.push(document);
      invoicesBySaleId.set(document.source_id, sourceBucket);
      if (document.source_remito_id) {
        const remitoBucket = invoicesByRemitoId.get(document.source_remito_id) ?? [];
        remitoBucket.push(document);
        invoicesByRemitoId.set(document.source_remito_id, remitoBucket);
      }
    }

    if (document.invoice_type === "NOTA_CREDITO_B" && document.document_kind === "CREDIT_NOTE") {
      if (document.related_billing_document_id) {
        const invoiceBucket = creditNotesByInvoiceId.get(document.related_billing_document_id) ?? [];
        invoiceBucket.push(document);
        creditNotesByInvoiceId.set(document.related_billing_document_id, invoiceBucket);
      }
      if (document.source_remito_id) {
        const remitoBucket = creditNotesByRemitoId.get(document.source_remito_id) ?? [];
        remitoBucket.push(document);
        creditNotesByRemitoId.set(document.source_remito_id, remitoBucket);
      }
    }
  }

  return params.remitos.map((remito): OccasionalOperation => {
    const sale = salesByDocumentId.get(remito.id) ?? null;
    const invoiceB = latestDocument([
      ...(sale ? invoicesBySaleId.get(sale.id) ?? [] : []),
      ...(invoicesByRemitoId.get(remito.id) ?? []),
    ]);
    const creditNoteB = latestDocument([
      ...(invoiceB ? creditNotesByInvoiceId.get(invoiceB.id) ?? [] : []),
      ...(creditNotesByRemitoId.get(remito.id) ?? []),
    ]);
    const fiscalStatus = resolveOccasionalFiscalStatus({ remito, sale, invoiceB, creditNoteB });

    return {
      id: remito.id,
      date: sale?.business_date ?? remito.issue_date,
      remito,
      sale,
      invoiceB,
      creditNoteB,
      fiscalStatus,
      closureStatus: sale ? (sale.closure_id ? "IN_CLOSED_CASH" : "PENDING_CLOSURE") : "WITHOUT_CASH_SALE",
      amount: moneyValue(sale?.amount_total ?? remito.total),
    };
  });
}

export function filterOccasionalOperations(operations: OccasionalOperation[], filters: OccasionalOperationFilters) {
  const search = filters.search.trim().toLowerCase();

  return operations.filter((operation) => {
    if (filters.paymentMethod !== "ALL" && operation.sale?.payment_method !== filters.paymentMethod) return false;
    if (filters.fiscalStatus !== "ALL" && operation.fiscalStatus !== filters.fiscalStatus) return false;
    if (filters.closureStatus !== "ALL" && operation.closureStatus !== filters.closureStatus) return false;
    if (!search) return true;

    return [
      operation.remito.customer_name,
      operation.remito.document_number,
      operation.sale?.receipt_reference,
      operation.sale?.customer_name_snapshot,
      operation.invoiceB?.voucher_full_number,
      operation.creditNoteB?.voucher_full_number,
    ].some((value) => String(value ?? "").toLowerCase().includes(search));
  });
}

export function calculateOccasionalTotals(operations: OccasionalOperation[]): OccasionalTotals {
  return operations.reduce<OccasionalTotals>((totals, operation) => {
    totals.operationsCount += 1;
    totals.remitosCount += 1;
    totals.cashSalesCount += operation.sale ? 1 : 0;
    totals.totalAmount += operation.amount;

    if (operation.invoiceB?.fiscal_status === "AUTHORIZED") {
      totals.authorizedInvoiceBTotal += moneyValue(operation.invoiceB.total);
      totals.invoiceBAuthorizedCount += 1;
    }
    if (operation.creditNoteB?.fiscal_status === "AUTHORIZED") {
      totals.authorizedCreditNoteBTotal += moneyValue(operation.creditNoteB.total);
      totals.creditNoteBAuthorizedCount += 1;
    }
    if (["PENDING_INVOICE_B", "DRAFT_BILLING", "REJECTED_BILLING"].includes(operation.fiscalStatus)) {
      totals.pendingInvoiceBTotal += operation.amount;
      totals.pendingInvoiceBCount += operation.fiscalStatus === "PENDING_INVOICE_B" ? 1 : 0;
    }
    if (operation.fiscalStatus === "DRAFT_BILLING") totals.draftBillingCount += 1;
    if (operation.fiscalStatus === "REJECTED_BILLING") totals.rejectedBillingCount += 1;
    if (operation.sale && ELECTRONIC_PAYMENT_METHODS.has(operation.sale.payment_method) && operation.fiscalStatus !== "INVOICE_B_AUTHORIZED" && operation.fiscalStatus !== "CREDIT_NOTE_B_AUTHORIZED") {
      totals.electronicPendingCount += 1;
    }

    const paymentKey = operation.sale?.payment_method ?? "SIN_VENTA";
    totals.byPaymentMethod[paymentKey] = (totals.byPaymentMethod[paymentKey] ?? 0) + operation.amount;
    totals.netFiscalTotal = totals.authorizedInvoiceBTotal - totals.authorizedCreditNoteBTotal;
    return totals;
  }, {
    operationsCount: 0,
    remitosCount: 0,
    cashSalesCount: 0,
    totalAmount: 0,
    authorizedInvoiceBTotal: 0,
    authorizedCreditNoteBTotal: 0,
    pendingInvoiceBTotal: 0,
    netFiscalTotal: 0,
    invoiceBAuthorizedCount: 0,
    creditNoteBAuthorizedCount: 0,
    pendingInvoiceBCount: 0,
    draftBillingCount: 0,
    rejectedBillingCount: 0,
    electronicPendingCount: 0,
    byPaymentMethod: {},
  });
}

export function canCreateInvoiceBDraftForOccasionalOperation(params: {
  operation: OccasionalOperation;
  billingEnabled: boolean;
  canCreateBilling: boolean;
}) {
  return Boolean(
    params.billingEnabled
    && params.canCreateBilling
    && params.operation.sale
    && params.operation.sale.status !== "ANULADA"
    && params.operation.sale.receipt_kind === "REMITO"
    && params.operation.sale.document_id
    && !params.operation.invoiceB,
  );
}
