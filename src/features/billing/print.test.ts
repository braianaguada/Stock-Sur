import { describe, expect, it, vi } from "vitest";
import { buildBillingPrintHtml } from "./print";
import { buildFiscalQrUrl } from "./lib/authorization";
import type { BillingDocumentLineRow, BillingDocumentRow, BillingRemitoReference } from "./types";

vi.stubGlobal("btoa", (value: string) => Buffer.from(value, "binary").toString("base64"));

const authorizedDocument: BillingDocumentRow = {
  id: "1ff5be9a-6c81-4a9c-b92b-50be5d930e77",
  company_id: "company-1",
  source_type: "CASH_SALE_FROM_REMITO",
  source_id: "2b404ea3-b2b9-4bec-b2bc-5e2bb0deec48",
  source_remito_id: "06fd90e5-1385-40b2-866b-cc32e11885e1",
  related_billing_document_id: null,
  document_kind: "INVOICE",
  invoice_type: "FACTURA_B",
  fiscal_status: "AUTHORIZED",
  provider: "AFIPSDK",
  environment: "dev",
  issuer_tax_id: null,
  issuer_name: null,
  issuer_tax_condition: null,
  receiver_name: "Consumidor Final",
  receiver_doc_type: "CONSUMIDOR_FINAL",
  receiver_doc_number: "0",
  receiver_tax_condition: "CONSUMIDOR_FINAL",
  receiver_fiscal_snapshot: null,
  currency: "ARS",
  currency_rate: 1,
  subtotal: 288,
  discount_total: 0,
  tax_total: 0,
  total: 288,
  point_of_sale: 1,
  voucher_number: 26436,
  voucher_full_number: "00001-00026436",
  voucher_date: "2026-06-03",
  cae: "86220215471868",
  cae_expires_at: "2026-06-13",
  authorized_at: "2026-06-03T13:14:03.364+00:00",
  authorized_by: "user-1",
  provider_errors: [],
  provider_observations: [],
  error_message: null,
  created_at: "2026-06-03T12:00:00Z",
  updated_at: "2026-06-03T13:14:03Z",
};

const lines: BillingDocumentLineRow[] = [{
  id: "line-1",
  billing_document_id: authorizedDocument.id,
  source_document_line_id: "source-line-1",
  line_order: 1,
  description: "ACCESO - PARA SOLDAR | CON CHICOTE",
  unit: null,
  quantity: 2,
  unit_price: 144,
  discount_pct: 0,
  discount_total: 0,
  vat_rate: 0,
  net_amount: 288,
  vat_amount: 0,
  total: 288,
}];

const remito: BillingRemitoReference = {
  id: "06fd90e5-1385-40b2-866b-cc32e11885e1",
  point_of_sale: 9,
  document_number: 43,
  customer_name: "Consumidor Final",
};

describe("billing print HTML", () => {
  it("renders an authorized Factura B A4 print view with fiscal data and QR image", () => {
    const html = buildBillingPrintHtml({
      document: authorizedDocument,
      lines,
      remito,
      qrDataUrl: "data:image/png;base64,qr",
    });

    expect(html).toContain("Factura B");
    expect(html).toContain("00001-00026436");
    expect(html).toContain("86220215471868");
    expect(html).toContain("2026-06-13");
    expect(html).toContain("Consumidor Final");
    expect(html).toContain("Homologacion / Dev");
    expect(html).toContain("00009-00000043");
    expect(html).toContain("alt=\"QR fiscal ARCA\"");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain(".page {");
    expect(html).toContain(".bottom-grid");
  });

  it("does not render the fiscal QR URL or payload text next to the QR", () => {
    const html = buildBillingPrintHtml({
      document: authorizedDocument,
      lines,
      remito,
      qrDataUrl: "data:image/png;base64,qr",
    });

    expect(html).not.toContain(buildFiscalQrUrl(authorizedDocument));
    expect(html).not.toContain("https://www.arca.gob.ar/fe/qr/");
    expect(html).not.toContain("\"codAut\":");
    expect(html).not.toContain("?p=");
  });

  it("uses clear issuer placeholders and keeps print-only actions hidden in print CSS", () => {
    const html = buildBillingPrintHtml({
      document: authorizedDocument,
      lines,
      remito,
      qrDataUrl: null,
    });

    expect(html).toContain("Razon social no configurada");
    expect(html).toContain("CUIT emisor no configurado");
    expect(html).toContain("Condicion IVA no configurada");
    expect(html).toContain("Completa razon social, CUIT y condicion IVA");
    expect(html).toContain("Imprimir / Guardar PDF");
    expect(html).toContain(".toolbar, .screen-warning, .no-print { display: none !important; }");
    expect(html).toContain("QR fiscal pendiente");
  });

  it("preserves Nota de Credito B association in the A4 layout", () => {
    const creditNote = {
      ...authorizedDocument,
      id: "credit-note-1",
      source_type: "CREDIT_NOTE_FROM_INVOICE" as const,
      related_billing_document_id: authorizedDocument.id,
      document_kind: "CREDIT_NOTE" as const,
      invoice_type: "NOTA_CREDITO_B" as const,
      voucher_full_number: "00001-00000003",
    };

    const html = buildBillingPrintHtml({
      document: creditNote,
      lines,
      relatedDocument: authorizedDocument,
    });

    expect(html).toContain("Nota de Credito B");
    expect(html).toContain("Cod. 008");
    expect(html).toContain("Comprobante asociado");
    expect(html).toContain("00001-00026436");
  });

  it("preserves Factura A drafts in the A4 layout", () => {
    const html = buildBillingPrintHtml({
      document: {
        ...authorizedDocument,
        invoice_type: "FACTURA_A",
        fiscal_status: "DRAFT",
        voucher_number: null,
        voucher_full_number: null,
        cae: null,
      },
      lines,
    });

    expect(html).toContain("Factura A");
    expect(html).toContain("Cod. 001");
    expect(html).toContain("BORRADOR - No valido como comprobante fiscal");
  });
});
