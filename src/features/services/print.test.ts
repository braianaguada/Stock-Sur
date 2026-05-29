import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { buildServiceDocumentPrintHtml } from "./print";
import type { ServiceDocument, ServiceDocumentLine } from "./types";

const document: ServiceDocument = {
  id: "service-doc-1",
  company_id: "company-1",
  customer_id: "customer-1",
  customers: {
    id: "customer-1",
    name: "QA Cliente",
    cuit: "20-12345678-9",
    email: "cliente@example.com",
    phone: "2990000000",
  },
  type: "REMITO",
  status: "APPROVED",
  number: 42,
  reference: "Servicio porton",
  issue_date: "2026-05-06",
  valid_until: null,
  delivery_time: "24 hs",
  payment_terms: "Contado",
  delivery_location: "Obra",
  intro_text: "SERVICIO EL PORTON - CRISTIAN NIETO, RODRIGO FLORES",
  closing_text: "Se deja constancia de la finalizacion del servicio.",
  subtotal: 100,
  total: 100,
  currency: "ARS",
  exchange_rate_source: null,
  exchange_rate: null,
  exchange_rate_date: null,
  exchange_rate_fetched_at: null,
  exchange_rate_snapshot_label: null,
  show_exchange_rate_note: true,
  pricing_mode: "DETAILED",
  global_total: null,
  hide_line_prices: false,
  created_at: "2026-05-06T12:00:00.000Z",
  created_by: "user-1",
};

const line: ServiceDocumentLine = {
  id: "line-1",
  document_id: "service-doc-1",
  description: "Reparacion y puesta en marcha",
  quantity: 1,
  unit: "un",
  unit_price: 100,
  line_total: 100,
  sort_order: 1,
};

describe("buildServiceDocumentPrintHtml", () => {
  it("builds a modern fixed A4 service remito layout", () => {
    const html = buildServiceDocumentPrintHtml({
      document,
      lines: [line],
      companySettings: {
        ...DEFAULT_COMPANY_SETTINGS,
        app_name: "Alpataco Refrigeracion",
        legal_name: "Alpataco Refrigeracion SRL",
        tax_id: "30-12345678-1",
        document_footer: "Footer configurado",
      },
    });

    expect(html).toContain("@page{size:A4 portrait;margin:0}");
    expect(html).toContain(".sheet{width:210mm;min-height:297mm");
    expect(html).toContain("tone-service is-service-remito");
    expect(html).toContain("Remito de servicio");
    expect(html).toContain("SERV-000042");
    expect(html).toContain("Descripcion del servicio");
    expect(html).toContain("SERVICIO EL PORTON");
    expect(html).toContain("Trabajos");
    expect(html).toContain("Reparacion y puesta en marcha");
    expect(html).toContain("Recibi conforme");
    expect(html).toContain("Subtotal sin IVA");
    expect(html).toContain("IVA");
    expect(html).toContain("No incluido");
    expect(html).toContain("Total servicio sin IVA");
    expect(html).toContain("Footer configurado");
  });

  it("uses a service quote totals close without signature", () => {
    const html = buildServiceDocumentPrintHtml({
      document: {
        ...document,
        type: "QUOTE",
        valid_until: "2026-05-20",
      },
      lines: [line],
      companySettings: DEFAULT_COMPANY_SETTINGS,
    });

    expect(html).toContain("tone-service-quote is-service-quote");
    expect(html).toContain("Presupuesto de servicio");
    expect(html).toContain("Total presupuesto sin IVA");
    expect(html).toContain(".is-service-quote .summary-row{grid-template-columns:66mm;justify-content:end}");
    expect(html).toContain(".is-service-quote .signature-row{display:none}");
  });

  it("hides line prices and keeps the global total in global mode", () => {
    const html = buildServiceDocumentPrintHtml({
      document: {
        ...document,
        type: "QUOTE",
        pricing_mode: "GLOBAL_TOTAL",
        hide_line_prices: true,
        global_total: 850,
        subtotal: 850,
        total: 850,
      },
      lines: [{ ...line, unit_price: null, line_total: 0 }],
      companySettings: DEFAULT_COMPANY_SETTINGS,
    });

    expect(html).not.toContain("Importe</th>");
    expect(html).not.toContain("P. unit");
    expect(html).toContain("850,00");
  });

  it("prints USD exchange snapshot and visible attachments", () => {
    const html = buildServiceDocumentPrintHtml({
      document: {
        ...document,
        type: "QUOTE",
        currency: "USD",
        exchange_rate_source: "BNA",
        exchange_rate: 1250,
        exchange_rate_date: "2026-05-28",
        exchange_rate_fetched_at: "2026-05-28T12:00:00.000Z",
        exchange_rate_snapshot_label: "Banco Nacion oficial vendedor - 2026-05-28",
      },
      lines: [line],
      attachments: [{
        id: "att-1",
        storage_bucket: "service-document-attachments",
        storage_path: "company/doc/file.webp",
        file_name: "referencia.webp",
        mime_type: "image/webp",
        title: "Referencia",
        description: "Frente del equipo",
        sort_order: 1,
        include_in_print: true,
        signed_url: "https://example.com/referencia.webp",
      }],
      companySettings: DEFAULT_COMPANY_SETTINGS,
    });

    expect(html).toContain("USD");
    expect(html).toContain("Cotizacion de referencia Banco Nacion");
    expect(html).toContain("Equivalente estimado");
    expect(html).toContain("Imagenes / referencias");
    expect(html).toContain("referencia.webp");
  });
});
