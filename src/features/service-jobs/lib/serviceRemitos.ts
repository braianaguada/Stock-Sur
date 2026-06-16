import type { DocType } from "@/features/documents/types";

export type ServiceRemitoDraftInput = {
  companyId: string;
  userId?: string | null;
  serviceId: string;
  pointOfSale: number;
  customerId?: string | null;
  customerName?: string | null;
  customerTaxId?: string | null;
  technicianIds: string[];
};

export type ServiceRemitoSummarySource = {
  total: number | string | null;
  lineCount: number;
  estimatedCost: number;
};

export type ServiceLinkableRemitoInput = {
  service_id?: string | null;
  customer_id?: string | null;
  customer_kind?: string | null;
};

export function buildServiceRemitoDraftPayload(input: ServiceRemitoDraftInput) {
  if (!input.customerId) {
    throw new Error("El trabajo necesita un cliente registrado para crear remitos de materiales");
  }

  const uniqueTechnicianIds = Array.from(new Set(input.technicianIds.filter(Boolean)));

  return {
    company_id: input.companyId,
    doc_type: "REMITO" as const,
    status: "BORRADOR" as const,
    point_of_sale: Math.max(1, Number(input.pointOfSale) || 1),
    customer_id: input.customerId || null,
    technician_id: uniqueTechnicianIds.length === 1 ? uniqueTechnicianIds[0] : null,
    customer_name: input.customerName?.trim() || null,
    customer_tax_id: input.customerTaxId?.trim() || null,
    customer_kind: "GENERAL" as const,
    service_id: input.serviceId,
    subtotal: 0,
    tax_total: 0,
    total: 0,
    created_by: input.userId ?? null,
  };
}

export function validateDocumentServiceLink(input: {
  docType: DocType;
  documentCompanyId: string;
  serviceCompanyId: string;
  documentCustomerId?: string | null;
  serviceCustomerId?: string | null;
  customerKind?: string | null;
  customerIsOccasional?: boolean | null;
}) {
  if (input.docType !== "REMITO") {
    throw new Error("Solo los remitos pueden asociarse a servicios");
  }
  if (input.documentCompanyId !== input.serviceCompanyId) {
    throw new Error("El servicio no pertenece a la empresa del documento");
  }
  if (input.customerKind === "INTERNO") {
    throw new Error("Un remito interno no puede asociarse a servicios");
  }
  if (!input.documentCustomerId) {
    throw new Error("El remito asociado a un servicio requiere cliente registrado");
  }
  if (!input.serviceCustomerId) {
    throw new Error("El servicio asociado no tiene cliente registrado");
  }
  if (input.documentCustomerId !== input.serviceCustomerId) {
    throw new Error("El cliente del remito debe coincidir con el cliente del servicio");
  }
  if (input.customerIsOccasional) {
    throw new Error("Un remito de cliente ocasional no puede asociarse a servicios");
  }
  return true;
}

export function isLinkableRemitoForService(
  remito: ServiceLinkableRemitoInput,
  input: { serviceId: string; customerId?: string | null },
) {
  if (!input.customerId) return false;
  if (remito.customer_kind === "INTERNO") return false;
  if (remito.customer_id !== input.customerId) return false;
  return remito.service_id === null || remito.service_id === undefined || remito.service_id === input.serviceId;
}

export function summarizeServiceRemitos(remitos: ServiceRemitoSummarySource[]) {
  return remitos.reduce(
    (summary, remito) => ({
      documents: summary.documents + 1,
      lineCount: summary.lineCount + remito.lineCount,
      total: summary.total + (Number(remito.total) || 0),
      estimatedCost: summary.estimatedCost + (Number(remito.estimatedCost) || 0),
    }),
    { documents: 0, lineCount: 0, total: 0, estimatedCost: 0 },
  );
}

export function getServiceRemitoTechnicianWarning(input: {
  serviceTechnicianIds: string[];
  documentTechnicianId?: string | null;
}) {
  const serviceTechnicianIds = new Set(input.serviceTechnicianIds.filter(Boolean));
  if (input.documentTechnicianId && serviceTechnicianIds.size > 0 && !serviceTechnicianIds.has(input.documentTechnicianId)) {
    return "El tecnico del remito no esta asignado al servicio.";
  }
  if (!input.documentTechnicianId && serviceTechnicianIds.size > 0) {
    return "El servicio tiene tecnicos asignados y el remito no tiene tecnico.";
  }
  return null;
}
