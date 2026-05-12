import { describe, expect, it, vi } from "vitest";
import {
  assertCanDuplicateDocument,
  buildDuplicateDocumentPayload,
  canDuplicateDocumentType,
  type DuplicateDocumentSource,
  type DuplicateLineSource,
} from "./duplicate";

const sourceDocument: DuplicateDocumentSource = {
  id: "doc-source-1",
  doc_type: "PRESUPUESTO",
  status: "APROBADO",
  point_of_sale: 3,
  document_number: 22,
  issue_date: "2026-04-01",
  customer_id: "customer-1",
  technician_id: "tech-1",
  origin_document_id: "cash-or-origin-link",
  customer_name: "Cliente Test",
  customer_tax_condition: "IVA RI",
  customer_tax_id: "20-123",
  customer_kind: "GENERAL",
  internal_remito_type: null,
  payment_terms: "Contado",
  delivery_address: "Deposito",
  salesperson: "Vendedor",
  valid_until: "2026-06-01",
  price_list_id: "price-list-1",
  notes: "Notas fuente",
  subtotal: 250,
  discount_total: 5,
  tax_total: 10,
  total: 260,
  external_invoice_number: "F-001",
  external_invoice_date: "2026-04-02",
  external_invoice_status: "ACTIVE",
};

const sourceLines: DuplicateLineSource[] = [
  {
    id: "line-source-1",
    document_id: "doc-source-1",
    line_order: 1,
    item_id: "item-1",
    sku_snapshot: "SKU-1",
    description: "Cable canal",
    unit: "un",
    quantity: 2,
    unit_price: 125,
    discount_pct: 0,
    tax_pct: 21,
    pricing_mode: "MANUAL_PRICE",
    suggested_unit_price: 150,
    base_cost_snapshot: 90,
    list_flete_pct_snapshot: 10,
    list_utilidad_pct_snapshot: 20,
    list_impuesto_pct_snapshot: 21,
    manual_margin_pct: 30,
    price_overridden_by: "user-1",
    price_overridden_at: "2026-04-01T12:00:00.000Z",
    line_total: 250,
  },
  {
    id: "line-source-2",
    document_id: "doc-source-1",
    line_order: 2,
    item_id: "item-2",
    sku_snapshot: "SKU-2",
    description: "Modulo",
    unit: "un",
    quantity: 1,
    unit_price: 10,
    pricing_mode: "LIST_PRICE",
    suggested_unit_price: 10,
    base_cost_snapshot: 5,
    list_flete_pct_snapshot: null,
    list_utilidad_pct_snapshot: 50,
    list_impuesto_pct_snapshot: null,
    manual_margin_pct: null,
    price_overridden_by: null,
    price_overridden_at: null,
    line_total: 10,
  },
];

describe("duplicate document logic", () => {
  it("builds a duplicated PRESUPUESTO draft with current date and copied commercial data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T15:00:00.000Z"));

    const currentDate = new Date().toISOString().slice(0, 10);
    const payload = buildDuplicateDocumentPayload({
      sourceDocument,
      sourceLines,
      currentDate,
    });

    expect(payload.document).toMatchObject({
      doc_type: "PRESUPUESTO",
      status: "BORRADOR",
      document_number: null,
      issue_date: "2026-05-08",
      customer_id: "customer-1",
      technician_id: "tech-1",
      customer_name: "Cliente Test",
      customer_tax_condition: "IVA RI",
      customer_tax_id: "20-123",
      payment_terms: "Contado",
      delivery_address: "Deposito",
      salesperson: "Vendedor",
      valid_until: "2026-06-01",
      price_list_id: "price-list-1",
      notes: "Notas fuente",
      source_document_id: "doc-source-1",
      source_document_type: "PRESUPUESTO",
      source_document_number_snapshot: "0003-00000022",
    });
    expect(payload.document.issue_date).not.toBe(sourceDocument.issue_date);

    vi.useRealTimers();
  });

  it("resets sensitive operational fields and external invoice data", () => {
    const payload = buildDuplicateDocumentPayload({
      sourceDocument: { ...sourceDocument, status: "EMITIDO", doc_type: "REMITO" },
      sourceLines,
      currentDate: "2026-05-08",
    });

    expect(payload.document).toMatchObject({
      doc_type: "REMITO",
      status: "BORRADOR",
      document_number: null,
      origin_document_id: null,
      valid_until: null,
      external_invoice_number: null,
      external_invoice_date: null,
      external_invoice_status: null,
    });
  });

  it("copies technician, all lines, prices and pricing snapshots without reusing line ids", () => {
    const payload = buildDuplicateDocumentPayload({
      sourceDocument: { ...sourceDocument, doc_type: "REMITO", status: "EMITIDO" },
      sourceLines,
      currentDate: "2026-05-08",
    });

    expect(payload.document.technician_id).toBe("tech-1");
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines.map((line) => "id" in line)).toEqual([false, false]);
    expect(payload.lines[0]).toMatchObject({
      document_id: "",
      item_id: "item-1",
      description: "Cable canal",
      unit: "un",
      quantity: 2,
      unit_price: 125,
      pricing_mode: "MANUAL_PRICE",
      suggested_unit_price: 150,
      base_cost_snapshot: 90,
      list_flete_pct_snapshot: 10,
      list_utilidad_pct_snapshot: 20,
      list_impuesto_pct_snapshot: 21,
      manual_margin_pct: 30,
      price_overridden_by: "user-1",
      price_overridden_at: "2026-04-01T12:00:00.000Z",
      line_total: 250,
    });
  });

  it("creates traceability event payload and does not copy previous events", () => {
    const payload = buildDuplicateDocumentPayload({
      sourceDocument,
      sourceLines,
      currentDate: "2026-05-08",
    });

    expect(payload.event).toEqual({
      event_type: "DUPLICATED_FROM_DOCUMENT",
      payload: {
        source_document_id: "doc-source-1",
        source_doc_type: "PRESUPUESTO",
        source_number: "0003-00000022",
      },
    });
  });

  it("allows only PRESUPUESTO and REMITO", () => {
    expect(canDuplicateDocumentType("PRESUPUESTO")).toBe(true);
    expect(canDuplicateDocumentType("REMITO")).toBe(true);
    expect(canDuplicateDocumentType("REMITO_DEVOLUCION")).toBe(false);
    expect(() => assertCanDuplicateDocument({ doc_type: "REMITO_DEVOLUCION" })).toThrow(
      "Solo se pueden duplicar presupuestos y remitos",
    );
  });
});
