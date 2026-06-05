import { describe, expect, it } from "vitest";
import { buildBillingPrintHtml } from "./print";
import type { BillingDocumentLineRow, BillingDocumentRow } from "./types";

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
    fiscal_status: "AUTHORIZED",
    provider: "AFIPSDK",
    environment: "dev",
    issuer_tax_id: "20-12345678-9",
    issuer_name: "Alpataco Refrigeracion",
    issuer_tax_condition: "Responsable Inscripto",
    receiver_name: "Consumidor Final",
    receiver_doc_type: "99",
    receiver_doc_number: null,
    receiver_tax_condition: "CONSUMIDOR_FINAL",
    receiver_fiscal_snapshot: null,
    currency: "ARS",
    currency_rate: 1,
    subtotal: 100,
    discount_total: 0,
    tax_total: 21,
    total: 121,
    point_of_sale: 1,
    voucher_number: 42,
    voucher_full_number: "00001-00000042",
    voucher_date: "2026-06-03",
    cae: "70400000000001",
    cae_expires_at: "2026-06-13",
    authorized_at: "2026-06-03T12:00:00Z",
    authorized_by: "user-1",
    provider_errors: [],
    provider_observations: [],
    error_message: null,
    created_at: "2026-06-03T11:00:00Z",
    updated_at: "2026-06-03T12:00:00Z",
    ...overrides,
  };
}

const line: BillingDocumentLineRow = {
  id: "line-1",
  billing_document_id: "billing-doc-1",
  source_document_line_id: "source-line-1",
  line_order: 1,
  description: "ACCESO - PARA SOLDAR",
  unit: "u",
  quantity: 1,
  unit_price: 121,
  discount_pct: 0,
  discount_total: 0,
  vat_rate: 21,
  net_amount: 100,
  vat_amount: 21,
  total: 121,
};

describe("billing print html", () => {
  it("prints Nota de Credito B with associated invoice and without QR payload URL", () => {
    const invoice = buildDocument();
    const creditNote = buildDocument({
      id: "credit-note-1",
      source_type: "CREDIT_NOTE_FROM_INVOICE",
      source_id: invoice.id,
      related_billing_document_id: invoice.id,
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      voucher_number: 3,
      voucher_full_number: "00001-00000003",
      cae: "70400000000002",
    });

    const html = buildBillingPrintHtml({
      document: creditNote,
      lines: [line],
      relatedDocument: invoice,
      qrDataUrl: "data:image/png;base64,qr",
    });

    expect(html).toContain("Nota de Credito B");
    expect(html).toContain("HOMOLOGACION / DEV");
    expect(html).toContain("00001-00000003");
    expect(html).toContain("70400000000002");
    expect(html).toContain("13/6/2026");
    expect(html).toContain("Comprobante asociado");
    expect(html).toContain("00001-00000042");
    expect(html).toContain("No se usa el PDF de Afip SDK.");
    expect(html).not.toContain("arca.gob.ar/fe/qr");
    expect(html).not.toContain("?p=");
  });

  it("prints Factura A as internal draft without QR or fiscal authorization", () => {
    const facturaA = buildDocument({
      invoice_type: "FACTURA_A",
      fiscal_status: "DRAFT",
      receiver_name: "TFD S.R.L.",
      receiver_doc_type: "80",
      receiver_doc_number: "30711582890",
      receiver_tax_condition: "RESPONSABLE_INSCRIPTO",
      voucher_number: null,
      voucher_full_number: null,
      voucher_date: null,
      cae: null,
      cae_expires_at: null,
      authorized_at: null,
      authorized_by: null,
    });

    const html = buildBillingPrintHtml({
      document: facturaA,
      lines: [line],
      qrDataUrl: null,
    });

    expect(html).toContain("Factura A");
    expect(html).toContain("BORRADOR - No valido como comprobante fiscal");
    expect(html).toContain("Factura A en preparacion. No emite comprobantes.");
    expect(html).toContain("<div class=\"letter\">A</div>");
    expect(html).toContain("TFD S.R.L.");
    expect(html).toContain("RESPONSABLE_INSCRIPTO");
    expect(html).toContain("Sin QR fiscal: borrador interno no autorizado.");
    expect(html).not.toContain("QR fiscal ARCA generado internamente.");
  });
});
