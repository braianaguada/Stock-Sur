import { describe, expect, it } from "vitest";
import type { DocumentFormState } from "../types";
import { buildDocumentDraftPersistencePayload } from "./draft-persistence";

const baseDraft: DocumentFormState = {
  recipient_type: "REGISTERED",
  doc_type: "PRESUPUESTO",
  point_of_sale: 9,
  customer_id: "customer-1",
  technician_id: "technician-1",
  service_id: "service-1",
  customer_name: "",
  customer_tax_condition: "",
  customer_tax_id: "",
  customer_kind: "EMPRESA",
  internal_remito_type: "",
  payment_terms: "30 días",
  delivery_address: "Depósito",
  salesperson: "Ana",
  valid_until: "2026-08-31",
  price_list_id: "list-1",
  notes: "Entregar por la mañana",
};

const customerSnapshot = {
  customer_id: "customer-1",
  customer_name: "Cliente registrado",
  customer_tax_id: "30-12345678-9",
  customer_tax_condition: null,
};

describe("buildDocumentDraftPersistencePayload", () => {
  it("normaliza un presupuesto sin conservar vínculos exclusivos de remitos", () => {
    expect(
      buildDocumentDraftPersistencePayload({
        draft: baseDraft,
        customerSnapshot,
        total: 1250,
      }),
    ).toEqual({
      doc_type: "PRESUPUESTO",
      point_of_sale: 9,
      customer_id: "customer-1",
      technician_id: "technician-1",
      service_id: null,
      customer_name: "Cliente registrado",
      customer_tax_condition: null,
      customer_tax_id: "30-12345678-9",
      customer_kind: "EMPRESA",
      internal_remito_type: null,
      payment_terms: "30 días",
      delivery_address: "Depósito",
      salesperson: "Ana",
      valid_until: "2026-08-31",
      price_list_id: "list-1",
      notes: "Entregar por la mañana",
      subtotal: 1250,
      tax_total: 0,
      total: 1250,
    });
  });

  it("elimina datos comerciales incompatibles de un remito interno", () => {
    const payload = buildDocumentDraftPersistencePayload({
      draft: {
        ...baseDraft,
        recipient_type: undefined,
        doc_type: "REMITO",
        customer_kind: "INTERNO",
        internal_remito_type: "DESCUENTO_SUELDO",
      },
      customerSnapshot,
      total: 800,
    });

    expect(payload).toMatchObject({
      customer_id: null,
      customer_name: null,
      customer_tax_id: null,
      customer_tax_condition: null,
      technician_id: "technician-1",
      service_id: null,
      internal_remito_type: "DESCUENTO_SUELDO",
      payment_terms: null,
      valid_until: null,
    });
  });

  it("conserva el servicio y el destinatario de un remito comercial", () => {
    const payload = buildDocumentDraftPersistencePayload({
      draft: {
        ...baseDraft,
        doc_type: "REMITO",
        valid_until: "2026-08-31",
      },
      customerSnapshot,
      total: 900,
    });

    expect(payload).toMatchObject({
      customer_id: "customer-1",
      service_id: "service-1",
      internal_remito_type: null,
      payment_terms: "30 días",
      valid_until: null,
    });
  });
});
