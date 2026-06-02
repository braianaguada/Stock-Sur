import type { AppRole } from "@/lib/permissions";
import { canAuthorizeBilling, canPrintBilling } from "@/lib/permissions";
import type { BillingDocumentRow } from "../types";

type BillingAccessContext = {
  companyRoleCodes?: string[];
  companyPermissionCodes?: string[];
};

export const FISCAL_QR_BASE_URL = "https://www.arca.gob.ar/fe/qr/";
export const FACTURA_B_CBTE_TIPO = 6;
export const CONSUMIDOR_FINAL_DOC_TIPO = 99;
export const CONSUMIDOR_FINAL_DOC_NRO = 0;

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
      document.document_kind === "INVOICE" &&
      document.invoice_type === "FACTURA_B" &&
      ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"].includes(document.fiscal_status) &&
      !document.cae,
  );
}

export function canShowPrintBillingDocumentAction(
  document: BillingDocumentRow | null,
  roles: AppRole[],
  context?: BillingAccessContext,
) {
  return Boolean(
    document &&
      canPrintBilling(roles, context) &&
      document.document_kind === "INVOICE" &&
      document.invoice_type === "FACTURA_B" &&
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
    tipoCmp: FACTURA_B_CBTE_TIPO,
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

export function encodeBase64Utf8(value: string) {
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
