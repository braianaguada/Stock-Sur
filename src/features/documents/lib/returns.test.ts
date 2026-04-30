import { describe, expect, it } from "vitest";
import {
  buildReturnDraftPayload,
  calculateReturnAvailability,
  validateReturnDocument,
  type ReturnDocument,
  type ReturnLine,
} from "./returns";

const originDocument: ReturnDocument = {
  id: "remito-1",
  company_id: "company-1",
  doc_type: "REMITO",
  status: "EMITIDO",
  point_of_sale: 1,
  document_number: 7,
  customer_id: "customer-1",
  technician_id: "tech-1",
  customer_name: "Cliente Demo",
  customer_tax_condition: "IVA RI",
  customer_tax_id: "20111111112",
  customer_kind: "GENERAL",
  internal_remito_type: null,
  payment_terms: "Contado",
  delivery_address: "Deposito",
  salesperson: "Ventas",
  price_list_id: "price-list-1",
  notes: "Remito original",
  subtotal: 100,
  tax_total: 0,
  total: 100,
};

const originLine: ReturnLine = {
  document_id: "remito-1",
  line_order: 1,
  item_id: "item-1",
  sku_snapshot: "SKU-1",
  description: "Cable canal",
  unit: "un",
  quantity: 10,
  unit_price: 10,
  pricing_mode: "MANUAL_PRICE",
  suggested_unit_price: 10,
  base_cost_snapshot: null,
  list_flete_pct_snapshot: null,
  list_utilidad_pct_snapshot: null,
  list_impuesto_pct_snapshot: null,
  manual_margin_pct: null,
  price_overridden_by: null,
  price_overridden_at: null,
  line_total: 100,
};

function returnLine(quantity: number): ReturnLine {
  return {
    ...originLine,
    document_id: "return-1",
    quantity,
    line_total: 0,
  };
}

describe("remito return logic", () => {
  it("allows returning the remaining quantity after previous emitted returns", () => {
    const result = validateReturnDocument({
      returnDocument: { origin_document_id: "remito-1", technician_id: "tech-1" },
      originDocument,
      originLines: [originLine],
      previousReturnLines: [returnLine(4)],
      newReturnLines: [returnLine(6)],
    });

    expect(result.ok).toBe(true);
    expect(result.availableByItem.get("item-1")).toEqual({ original: 10, returned: 4, available: 6 });
  });

  it("blocks returning more than the original quantity minus previous emitted returns", () => {
    expect(() =>
      validateReturnDocument({
        returnDocument: { origin_document_id: "remito-1", technician_id: "tech-1" },
        originDocument,
        originLines: [originLine],
        previousReturnLines: [returnLine(6)],
        newReturnLines: [returnLine(5)],
      }),
    ).toThrow("maximo: 4, solicitado: 5");
  });

  it("requires an origin document id", () => {
    expect(() =>
      validateReturnDocument({
        returnDocument: { origin_document_id: null, technician_id: "tech-1" },
        originDocument,
        originLines: [originLine],
        previousReturnLines: [],
        newReturnLines: [returnLine(1)],
      }),
    ).toThrow("remito original");
  });

  it("requires the origin document to be an emitted remito", () => {
    expect(() =>
      validateReturnDocument({
        returnDocument: { origin_document_id: "remito-1", technician_id: "tech-1" },
        originDocument: { ...originDocument, doc_type: "PRESUPUESTO" },
        originLines: [originLine],
        previousReturnLines: [],
        newReturnLines: [returnLine(1)],
      }),
    ).toThrow("remito emitido");
  });

  it("requires a technician on the return document", () => {
    expect(() =>
      validateReturnDocument({
        returnDocument: { origin_document_id: "remito-1", technician_id: null },
        originDocument,
        originLines: [originLine],
        previousReturnLines: [],
        newReturnLines: [returnLine(1)],
      }),
    ).toThrow("tecnico");
  });

  it("builds a draft return payload from an emitted remito without issuing it", () => {
    const payload = buildReturnDraftPayload({
      originDocument,
      originLines: [originLine],
      sourceNumber: "0001-00000007",
    });

    expect(payload.document).toMatchObject({
      doc_type: "REMITO_DEVOLUCION",
      status: "BORRADOR",
      customer_id: "customer-1",
      technician_id: "tech-1",
      origin_document_id: "remito-1",
      source_document_id: "remito-1",
      source_document_type: "REMITO",
      source_document_number_snapshot: "0001-00000007",
      total: 0,
    });
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0]).toMatchObject({
      item_id: "item-1",
      quantity: 10,
      line_total: 0,
    });
  });

  it("calculates availability per item from original and previous return lines", () => {
    const availability = calculateReturnAvailability({
      originLines: [originLine],
      previousReturnLines: [returnLine(3), returnLine(2)],
    });

    expect(availability.get("item-1")).toEqual({ original: 10, returned: 5, available: 5 });
  });
});
