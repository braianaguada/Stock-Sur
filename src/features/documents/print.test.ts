import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { buildDocumentPrintHtml } from "./print";
import type { DocLineRow, DocRow } from "./types";

const document: DocRow = {
  id: "doc-1",
  doc_type: "REMITO",
  status: "EMITIDO",
  point_of_sale: 9,
  document_number: 32,
  issue_date: "2026-05-06",
  customer_id: null,
  technician_id: "tech-1",
  origin_document_id: null,
  customer_name: "Cliente Demo",
  customer_tax_id: "20-12345678-9",
  customer_tax_condition: "Responsable inscripto",
  customer_kind: "GENERAL",
  internal_remito_type: null,
  payment_terms: "Contado",
  delivery_address: "Deposito central",
  salesperson: "Ventas",
  valid_until: null,
  price_list_id: null,
  source_document_id: null,
  source_document_type: "PRESUPUESTO",
  source_document_number_snapshot: "0009-00000012",
  external_invoice_number: "FA-0001-00000123",
  external_invoice_date: "2026-05-05",
  external_invoice_status: "ACTIVE",
  notes: "Entregar con remito firmado",
  subtotal: 100,
  tax_total: 21,
  total: 121,
  created_at: "2026-05-06T12:00:00.000Z",
};

const line: Pick<
  DocLineRow,
  "line_order" | "sku_snapshot" | "description" | "quantity" | "unit" | "unit_price" | "line_total"
> = {
  line_order: 1,
  sku_snapshot: "SS-000015",
  description: "Aceite - refrigeracion",
  quantity: 2,
  unit: "un",
  unit_price: 50,
  line_total: 100,
};

describe("buildDocumentPrintHtml", () => {
  it("builds a compact fixed A4 print layout with document data", () => {
    const html = buildDocumentPrintHtml({
      document,
      lines: [line],
      companySettings: {
        ...DEFAULT_COMPANY_SETTINGS,
        app_name: "Alpataco Refrigeracion",
        legal_name: "Alpataco Refrigeracion SRL",
        tax_id: "30-12345678-1",
        document_footer: "Footer configurado",
      },
      technicianName: "Tecnico Demo",
    });

    expect(html).toContain("@page{size:A4 portrait;margin:0}");
    expect(html).toContain(".sheet{width:210mm;min-height:297mm");
    expect(html).toContain(".content{display:flex;min-height:calc(297mm - 4px);flex:1;flex-direction:column;padding:10mm 11mm 8.5mm}");
    expect(html).toContain(".brand{display:grid;grid-template-columns:55mm minmax(0,1fr)");
    expect(html).toContain(".brand-logo{max-width:51mm;max-height:37mm");
    expect(html).toContain("table-layout:fixed");
    expect(html).toContain("height:5.5mm");
    expect(html).toContain(".density-compact");
    expect(html).toContain(".tone-remito");
    expect(html).toContain("Productos");
    expect(html).not.toContain("<th class=\"c-sku\">SKU</th>");
    expect(html).toContain("status-chip");
    expect(html).toContain("notes service-notes avoid-break");
    expect(html).toContain(".service-notes{margin-top:3.6mm}");
    expect(html).toContain(".signature-line{padding-top:8mm");
    expect(html).toContain("Recibi conforme");
    expect(html).toContain("break-inside:avoid");
    expect(html).toContain(".summary-row{margin-top:auto");
    expect(html).toContain("Cliente Demo");
    expect(html).toContain("Tecnico Demo");
    expect(html).toContain("FA-0001-00000123");
    expect(html).toContain("0009-00000032");
    expect(html).toContain("Footer configurado");
  });

  it("shows pending numbering for draft documents", () => {
    const html = buildDocumentPrintHtml({
      document: {
        ...document,
        status: "BORRADOR",
        document_number: null,
      },
      lines: [line],
      companySettings: DEFAULT_COMPANY_SETTINGS,
    });

    expect(html).toContain("Pendiente de numeracion");
    expect(html).toContain("doc-number is-pending");
  });
});
