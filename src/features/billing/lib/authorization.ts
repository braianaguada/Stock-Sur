import type { AppRole } from "@/lib/permissions";
import { canAuthorizeBilling, canCreateBillingCreditNote, canPrintBilling } from "@/lib/permissions";
import type { BillingDocumentRow } from "../types";

type BillingAccessContext = {
  companyRoleCodes?: string[];
  companyPermissionCodes?: string[];
};

export const FISCAL_QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/";
const FACTURA_B_CBTE_TIPO = 6;
export const NOTA_CREDITO_B_CBTE_TIPO = 8;
const CONSUMIDOR_FINAL_DOC_TIPO = 99;
const CONSUMIDOR_FINAL_DOC_NRO = 0;
const STALE_AUTHORIZING_MINUTES = 10;

export function getBillingDocumentTypeLabel(document: Pick<BillingDocumentRow, "document_kind" | "invoice_type"> | null) {
  if (!document) return "Comprobante fiscal";
  if (document.document_kind === "INVOICE" && document.invoice_type === "FACTURA_A") return "Factura A";
  if (document.document_kind === "CREDIT_NOTE" && document.invoice_type === "NOTA_CREDITO_B") return "Nota de Credito B";
  return "Factura B";
}

export function getBillingDocumentOriginLabel(document: Pick<BillingDocumentRow, "source_type" | "document_kind"> | null) {
  if (!document) return "-";
  if (document.source_type === "CREDIT_NOTE_FROM_INVOICE" || document.document_kind === "CREDIT_NOTE") return "Factura fiscal";
  return "Caja / Remito";
}

export function hasActiveTotalCreditNoteForInvoice(invoice: BillingDocumentRow, documents: BillingDocumentRow[]) {
  return documents.some((document) =>
    document.document_kind === "CREDIT_NOTE" &&
    document.invoice_type === "NOTA_CREDITO_B" &&
    document.related_billing_document_id === invoice.id &&
    document.fiscal_status !== "CANCELLED_INTERNAL",
  );
}

export function canShowCreateCreditNoteBAction(
  document: BillingDocumentRow | null,
  documents: BillingDocumentRow[],
  roles: AppRole[],
  context?: BillingAccessContext,
) {
  return Boolean(
    document &&
      canCreateBillingCreditNote(roles, context) &&
      document.provider === "AFIPSDK" &&
      document.environment === "dev" &&
      document.document_kind === "INVOICE" &&
      document.invoice_type === "FACTURA_B" &&
      document.fiscal_status === "AUTHORIZED" &&
      document.cae &&
      document.voucher_number &&
      !hasActiveTotalCreditNoteForInvoice(document, documents),
  );
}

export function canShowAuthorizeBillingDocumentAction(
  document: BillingDocumentRow | null,
  roles: AppRole[],
  context?: BillingAccessContext,
) {
  return Boolean(
    document &&
      canAuthorizeBilling(roles, context) &&
      document.provider === "AFIPSDK" &&
      document.environment === "dev" &&
      (
        (document.document_kind === "INVOICE" && document.invoice_type === "FACTURA_B") ||
        (document.document_kind === "CREDIT_NOTE" && document.invoice_type === "NOTA_CREDITO_B")
      ) &&
      ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"].includes(document.fiscal_status) &&
      !document.cae,
  );
}

export function isRecentAuthorizingDocument(document: BillingDocumentRow | null, now = new Date()) {
  if (!document || document.fiscal_status !== "AUTHORIZING") return false;
  const updatedAt = new Date(document.updated_at);
  if (!Number.isFinite(updatedAt.getTime())) return true;
  return now.getTime() - updatedAt.getTime() <= STALE_AUTHORIZING_MINUTES * 60 * 1000;
}

export function canShowResetStaleAuthorizationAction(
  document: BillingDocumentRow | null,
  roles: AppRole[],
  context?: BillingAccessContext,
  now = new Date(),
) {
  if (!document || !canAuthorizeBilling(roles, context)) return false;
  if (document.fiscal_status !== "AUTHORIZING") return false;
  if (document.cae || document.voucher_number) return false;
  return !isRecentAuthorizingDocument(document, now);
}

export function canShowPrintBillingDocumentAction(
  document: BillingDocumentRow | null,
  roles: AppRole[],
  context?: BillingAccessContext,
) {
  if (
    document &&
    canPrintBilling(roles, context) &&
    document.document_kind === "INVOICE" &&
    document.invoice_type === "FACTURA_A" &&
    ["DRAFT", "BLOCKED", "CANCELLED_INTERNAL"].includes(document.fiscal_status) &&
    !document.cae &&
    !document.voucher_number
  ) {
    return true;
  }

  return Boolean(
      document &&
      canPrintBilling(roles, context) &&
      (
        (document.document_kind === "INVOICE" && document.invoice_type === "FACTURA_B") ||
        (document.document_kind === "CREDIT_NOTE" && document.invoice_type === "NOTA_CREDITO_B")
      ) &&
      document.fiscal_status === "AUTHORIZED" &&
      document.cae,
  );
}

export function buildFiscalQrPayload(document: BillingDocumentRow) {
  const issuerCuit = Number((document.issuer_tax_id ?? "").replace(/\D/g, ""));
  return {
    ver: 1,
    fecha: document.voucher_date ?? document.authorized_at?.slice(0, 10) ?? document.created_at.slice(0, 10),
    cuit: issuerCuit,
    ptoVta: Number(document.point_of_sale ?? 0),
    tipoCmp: document.invoice_type === "NOTA_CREDITO_B" ? NOTA_CREDITO_B_CBTE_TIPO : FACTURA_B_CBTE_TIPO,
    nroCmp: Number(document.voucher_number ?? 0),
    importe: Number(document.total),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: CONSUMIDOR_FINAL_DOC_TIPO,
    nroDocRec: CONSUMIDOR_FINAL_DOC_NRO,
    tipoCodAut: "E",
    codAut: Number(document.cae ?? 0),
  };
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function buildFiscalQrUrl(document: BillingDocumentRow) {
  const payload = buildFiscalQrPayload(document);
  return `${FISCAL_QR_BASE_URL}?p=${encodeURIComponent(encodeBase64Utf8(JSON.stringify(payload)))}`;
}
