import { describe, expect, it } from "vitest";
import {
  buildDocumentCustomerSnapshot,
  changeDocumentRecipientType,
  getCustomerDisplayName,
  OCCASIONAL_CUSTOMER_DISPLAY_NAME,
  resolveDocumentRecipient,
  validateDocumentRecipientDraft,
} from "./utils";

describe("document customer helpers", () => {
  it("uses customer_id null as the occasional customer rule", () => {
    expect(getCustomerDisplayName({ customer_id: null, customer_name: "Snapshot viejo" })).toBe(
      OCCASIONAL_CUSTOMER_DISPLAY_NAME,
    );
  });

  it("keeps an occasional buyer name as secondary display", () => {
    expect(resolveDocumentRecipient({ customer_id: null, customer_name: "Juan Perez" })).toMatchObject({
      primaryName: OCCASIONAL_CUSTOMER_DISPLAY_NAME,
      secondaryName: "Juan Perez",
      isOccasional: true,
      isRegisteredCustomer: false,
    });
  });

  it("never shows occasional when a registered customer exists", () => {
    expect(resolveDocumentRecipient({
      customer_id: "customer-1",
      customer_name: "Cliente ocasional",
      customers: { name: "Cliente Real SA" },
    }).primaryName).toBe("Cliente Real SA");
  });

  it("uses the technician as internal recipient", () => {
    expect(resolveDocumentRecipient(
      { customer_kind: "INTERNO", customer_id: null, customer_name: null },
      { technicianName: "Tecnico Demo", internalReference: "Instalacion" },
    )).toMatchObject({
      primaryName: "Tecnico Demo",
      secondaryName: "Instalacion",
      isInternal: true,
    });
  });

  it("uses the registered customer name when customer_id is present", () => {
    expect(getCustomerDisplayName({
      customer_id: "customer-1",
      customer_name: "Snapshot",
      customers: { name: "Cliente SA" },
    })).toBe("Cliente SA");
  });

  it("clears occasional customer snapshot when a registered customer is selected", () => {
    expect(buildDocumentCustomerSnapshot({
      customerId: "customer-1",
      manualCustomerName: OCCASIONAL_CUSTOMER_DISPLAY_NAME,
      pickedCustomer: { id: "customer-1", name: "Cliente SA", cuit: "20409378472" },
      manualTaxId: "",
      manualTaxCondition: "",
    })).toEqual({
      customer_id: "customer-1",
      customer_name: "Cliente SA",
      customer_tax_id: "20409378472",
      customer_tax_condition: null,
    });
  });

  it("clears manual fiscal fields for an occasional customer", () => {
    expect(buildDocumentCustomerSnapshot({
      customerId: "",
      manualCustomerName: "Juan Perez",
      pickedCustomer: null,
      manualTaxId: "20-123",
      manualTaxCondition: "RI",
    })).toEqual({
      customer_id: null,
      customer_name: "Juan Perez",
      customer_tax_id: null,
      customer_tax_condition: null,
    });
  });

  it("changes recipient without clearing commercial details", () => {
    const draft = {
      recipient_type: "REGISTERED" as const,
      doc_type: "PRESUPUESTO" as const,
      point_of_sale: 1,
      customer_id: "customer-1",
      technician_id: "technician-1",
      service_id: "service-1",
      customer_name: "Cliente registrado",
      customer_tax_condition: "RI",
      customer_tax_id: "20-123",
      customer_kind: "EMPRESA" as const,
      internal_remito_type: "" as const,
      payment_terms: "Cuenta corriente",
      delivery_address: "Deposito",
      salesperson: "Ana",
      valid_until: "2026-07-01",
      price_list_id: "list-1",
      notes: "Conservar estas notas",
    };

    expect(changeDocumentRecipientType(draft, "OCCASIONAL")).toEqual({
      ...draft,
      recipient_type: "OCCASIONAL",
      customer_id: "",
      technician_id: "",
      service_id: "",
      customer_name: "Cliente ocasional",
      customer_tax_condition: "",
      customer_tax_id: "",
      customer_kind: "GENERAL",
    });
  });

  it("blocks a service linked to another customer", () => {
    expect(() => validateDocumentRecipientDraft({
      doc_type: "REMITO",
      point_of_sale: 1,
      customer_id: "customer-1",
      technician_id: "",
      service_id: "service-1",
      customer_name: "Cliente 1",
      customer_tax_condition: "",
      customer_tax_id: "",
      customer_kind: "GENERAL",
      internal_remito_type: "",
      payment_terms: "",
      delivery_address: "",
      salesperson: "",
      valid_until: "",
      price_list_id: "list-1",
      notes: "",
    }, [{
      id: "service-1",
      title: "Service",
      status: "OPEN",
      job_id: "job-1",
      jobTitle: "Trabajo",
      customerId: "customer-2",
      customerName: "Cliente 2",
    }])).toThrow("debe coincidir");
  });
});
