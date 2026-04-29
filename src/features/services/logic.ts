import { DEFAULT_SERVICE_TEXTS } from "./constants";
import type { ServiceDocument, ServiceDocumentForm, ServiceDocumentStatus } from "./types";

export function buildInitialServiceDocumentForm(settings: {
  document_tagline?: string | null;
  document_footer?: string | null;
  service_default_intro_text?: string | null;
  service_default_closing_text?: string | null;
  service_default_delivery_time?: string | null;
  service_default_payment_terms?: string | null;
  service_default_delivery_location?: string | null;
  service_default_valid_days?: number | null;
  address?: string | null;
}): ServiceDocumentForm {
  const validDays = settings.service_default_valid_days ?? 0;
  const validUntil = validDays > 0 ? new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
  return {
    customer_id: "",
    status: "DRAFT",
    reference: "",
    issue_date: new Date().toISOString().slice(0, 10),
    valid_until: validUntil,
    intro_text: settings.document_tagline || settings.service_default_intro_text || DEFAULT_SERVICE_TEXTS.intro_text,
    delivery_time: settings.service_default_delivery_time || DEFAULT_SERVICE_TEXTS.delivery_time,
    payment_terms: settings.service_default_payment_terms || DEFAULT_SERVICE_TEXTS.payment_terms,
    delivery_location: settings.service_default_delivery_location || settings.address || DEFAULT_SERVICE_TEXTS.delivery_location,
    closing_text: settings.service_default_closing_text || settings.document_footer || DEFAULT_SERVICE_TEXTS.closing_text,
    currency: "ARS",
  };
}

export function canTransitionServiceDocument(document: Pick<ServiceDocument, "status">, target: ServiceDocumentStatus) {
  if (document.status === target) return false;
  if (document.status === "CANCELLED") return false;
  if (document.status === "REJECTED") return false;
  if (target === "SENT") return document.status === "DRAFT";
  if (target === "APPROVED") return document.status === "DRAFT" || document.status === "SENT";
  if (target === "REJECTED") return document.status === "DRAFT" || document.status === "SENT";
  if (target === "CANCELLED") return document.status === "DRAFT" || document.status === "SENT" || document.status === "APPROVED";
  return false;
}

export function canConvertServiceDocumentToRemito(document: Pick<ServiceDocument, "type" | "status">) {
  return document.type === "QUOTE" && document.status === "APPROVED";
}
