import { describe, expect, it, vi } from "vitest";
import {
  buildFiscalQrPayload,
  buildFiscalQrUrl,
  canShowAuthorizeBillingDocumentAction,
  canShowCreateCreditNoteBAction,
  canShowPrintBillingDocumentAction,
  FISCAL_QR_BASE_URL,
  NOTA_CREDITO_B_CBTE_TIPO,
} from "./authorization";
import type { BillingDocumentRow } from "../types";

vi.stubGlobal("btoa", (value: string) => Buffer.from(value, "binary").toString("base64"));

function buildDocument(overrides: Partial<BillingDocumentRow> = {}): BillingDocumentRow {
  return {
    id: "billing-doc-1",
    company_id: "company-1",
    source_type: "CASH_SALE_FROM_REMITO",
    source_id: "cash-sale-1",
    source_remito_id: "remito-1",
    related_billing_document_id: null,
    document_kind: "INVOICE",
    invoice_type: "FACTURA_B",
    fiscal_status: "DRAFT",
    provider: "AFIPSDK",
    environment: "dev",
    issuer_tax_id: "20-12345678-9",
    issuer_name: "Alpataco Refrigeracion",
    issuer_tax_condition: "Responsable Inscripto",
    receiver_name: "Consumidor Final",
    receiver_doc_type: "CONSUMIDOR_FINAL",
    receiver_doc_number: "0",
    receiver_tax_condition: "CONSUMIDOR_FINAL",
    currency: "ARS",
    currency_rate: 1,
    subtotal: 100,
    discount_total: 0,
    tax_total: 21,
    total: 121,
    point_of_sale: 1,
    voucher_number: null,
    voucher_full_number: null,
    voucher_date: null,
    cae: null,
    cae_expires_at: null,
    authorized_at: null,
    authorized_by: null,
    provider_errors: [],
    provider_observations: [],
    error_message: null,
    created_at: "2026-06-02T12:00:00Z",
    updated_at: "2026-06-02T12:00:00Z",
    ...overrides,
  };
}

describe("billing authorization UI helpers", () => {
  it("shows authorize only for editable Factura B dev documents without CAE and permission", () => {
    const context = { companyPermissionCodes: ["billing.authorize"] };

    expect(canShowAuthorizeBillingDocumentAction(buildDocument(), ["user"], context)).toBe(true);
    expect(canShowAuthorizeBillingDocumentAction(buildDocument({ fiscal_status: "AUTHORIZED", cae: "70400000000001" }), ["user"], context)).toBe(false);
    expect(canShowAuthorizeBillingDocumentAction(buildDocument({ environment: "prod" }), ["user"], context)).toBe(false);
    expect(canShowAuthorizeBillingDocumentAction(buildDocument(), ["user"], { companyPermissionCodes: [] })).toBe(false);
  });

  it("shows create credit note only for authorized Factura B without active total credit note", () => {
    const context = { companyPermissionCodes: ["billing.credit_note"] };
    const invoice = buildDocument({
      fiscal_status: "AUTHORIZED",
      voucher_number: 42,
      voucher_full_number: "00001-00000042",
      cae: "70400000000001",
    });
    const creditNote = buildDocument({
      id: "credit-note-1",
      source_type: "CREDIT_NOTE_FROM_INVOICE",
      source_id: invoice.id,
      related_billing_document_id: invoice.id,
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      fiscal_status: "DRAFT",
    });

    expect(canShowCreateCreditNoteBAction(invoice, [invoice], ["user"], context)).toBe(true);
    expect(canShowCreateCreditNoteBAction(invoice, [invoice, creditNote], ["user"], context)).toBe(false);
    expect(canShowCreateCreditNoteBAction(buildDocument(), [], ["user"], context)).toBe(false);
    expect(canShowCreateCreditNoteBAction(creditNote, [creditNote], ["user"], context)).toBe(false);
    expect(canShowCreateCreditNoteBAction(invoice, [invoice], ["user"], { companyPermissionCodes: [] })).toBe(false);
  });

  it("shows print only for authorized Factura B with CAE and print permission", () => {
    const context = { companyPermissionCodes: ["billing.print"] };
    const authorized = buildDocument({ fiscal_status: "AUTHORIZED", cae: "70400000000001" });

    expect(canShowPrintBillingDocumentAction(authorized, ["user"], context)).toBe(true);
    expect(canShowPrintBillingDocumentAction(buildDocument({
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      fiscal_status: "AUTHORIZED",
      cae: "70400000000002",
    }), ["user"], context)).toBe(true);
    expect(canShowPrintBillingDocumentAction(buildDocument(), ["user"], context)).toBe(false);
    expect(canShowPrintBillingDocumentAction(authorized, ["user"], { companyPermissionCodes: [] })).toBe(false);
  });

  it("builds ARCA fiscal QR URL with base64 JSON payload", () => {
    const document = buildDocument({
      fiscal_status: "AUTHORIZED",
      voucher_date: "2026-06-02",
      voucher_number: 8,
      cae: "70400000000001",
    });

    expect(buildFiscalQrPayload(document)).toMatchObject({
      ver: 1,
      fecha: "2026-06-02",
      cuit: 20123456789,
      ptoVta: 1,
      tipoCmp: 6,
      nroCmp: 8,
      importe: 121,
      moneda: "PES",
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: "E",
      codAut: 70400000000001,
    });
    expect(buildFiscalQrUrl(document)).toContain(FISCAL_QR_BASE_URL);
    expect(buildFiscalQrUrl(document)).toContain("p=");
  });

  it("builds ARCA fiscal QR payload with Nota de Credito B voucher type", () => {
    const document = buildDocument({
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      fiscal_status: "AUTHORIZED",
      voucher_date: "2026-06-03",
      voucher_number: 3,
      cae: "70400000000002",
    });

    expect(buildFiscalQrPayload(document)).toMatchObject({
      tipoCmp: NOTA_CREDITO_B_CBTE_TIPO,
      nroCmp: 3,
      codAut: 70400000000002,
    });
  });
});
