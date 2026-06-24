import { describe, expect, it } from "vitest";
import {
  buildServiceRemitoDraftPayload,
  getServiceRemitoTechnicianWarning,
  isLinkableRemitoForService,
  summarizeServiceRemitos,
  validateDocumentServiceLink,
} from "./serviceRemitos";

describe("service remito helpers", () => {
  it("creates a BORRADOR REMITO linked to a service without moving stock", () => {
    expect(buildServiceRemitoDraftPayload({
      companyId: "company-1",
      userId: "user-1",
      serviceId: "service-1",
      pointOfSale: 3,
      customerId: "customer-1",
      customerName: "Cliente SA",
      customerTaxId: "20300000001",
      technicianIds: ["tech-1"],
    })).toMatchObject({
      company_id: "company-1",
      doc_type: "REMITO",
      status: "BORRADOR",
      service_id: "service-1",
      technician_id: "tech-1",
      total: 0,
    });
  });

  it("does not auto-pick a technician when service has many technicians", () => {
    expect(buildServiceRemitoDraftPayload({
      companyId: "company-1",
      serviceId: "service-1",
      pointOfSale: 1,
      customerId: "customer-1",
      technicianIds: ["tech-1", "tech-2"],
    }).technician_id).toBeNull();
  });

  it("requires a registered job customer to create service remitos", () => {
    expect(() => buildServiceRemitoDraftPayload({
      companyId: "company-1",
      serviceId: "service-1",
      pointOfSale: 1,
      customerId: null,
      technicianIds: [],
    })).toThrow("cliente registrado");
  });

  it("allows only REMITO service links", () => {
    expect(validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
      customerKind: "GENERAL",
    })).toBe(true);
    expect(() => validateDocumentServiceLink({
      docType: "PRESUPUESTO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
    })).toThrow("remitos");
    expect(() => validateDocumentServiceLink({
      docType: "REMITO_DEVOLUCION",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
    })).toThrow("remitos");
  });

  it("blocks a service from another company", () => {
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-2",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
    })).toThrow("empresa");
  });

  it("requires document and service customer to match", () => {
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: null,
      serviceCustomerId: "customer-1",
    })).toThrow("cliente registrado");
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: null,
    })).toThrow("servicio asociado no tiene cliente");
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-2",
    })).toThrow("coincidir");
  });

  it("blocks internal and occasional documents from service links", () => {
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
      customerKind: "INTERNO",
    })).toThrow("interno");
    expect(() => validateDocumentServiceLink({
      docType: "REMITO",
      documentCompanyId: "company-1",
      serviceCompanyId: "company-1",
      documentCustomerId: "customer-1",
      serviceCustomerId: "customer-1",
      customerIsOccasional: true,
    })).toThrow("ocasional");
  });

  it("filters linkable remitos by service and customer", () => {
    expect(isLinkableRemitoForService(
      { service_id: null, customer_id: "customer-1", customer_kind: "GENERAL" },
      { serviceId: "service-1", customerId: "customer-1" },
    )).toBe(true);
    expect(isLinkableRemitoForService(
      { service_id: "service-1", customer_id: "customer-1", customer_kind: "GENERAL" },
      { serviceId: "service-1", customerId: "customer-1" },
    )).toBe(true);
    expect(isLinkableRemitoForService(
      { service_id: "service-2", customer_id: "customer-1", customer_kind: "GENERAL" },
      { serviceId: "service-1", customerId: "customer-1" },
    )).toBe(false);
    expect(isLinkableRemitoForService(
      { service_id: null, customer_id: null, customer_kind: "GENERAL" },
      { serviceId: "service-1", customerId: "customer-1" },
    )).toBe(false);
    expect(isLinkableRemitoForService(
      { service_id: null, customer_id: "customer-1", customer_kind: "INTERNO" },
      { serviceId: "service-1", customerId: "customer-1" },
    )).toBe(false);
  });

  it("summarizes service remitos", () => {
    expect(summarizeServiceRemitos([
      { total: 1000, lineCount: 2, estimatedCost: 600 },
      { total: "500", lineCount: 1, estimatedCost: 250 },
    ])).toEqual({ documents: 2, lineCount: 3, total: 1500, estimatedCost: 850 });
  });

  it("returns technician consistency warnings without blocking links", () => {
    expect(getServiceRemitoTechnicianWarning({
      serviceTechnicianIds: ["tech-1"],
      documentTechnicianId: "tech-2",
    })).toContain("no esta asignado");
    expect(getServiceRemitoTechnicianWarning({
      serviceTechnicianIds: ["tech-1"],
      documentTechnicianId: null,
    })).toContain("no tiene tecnico");
  });
});
