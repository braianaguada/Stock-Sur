import type { DocumentFormState } from "../types";

type CustomerSnapshot = {
  customer_id: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_tax_condition: string | null;
};

export function buildDocumentDraftPersistencePayload({
  draft,
  customerSnapshot,
  total,
}: {
  draft: DocumentFormState;
  customerSnapshot: CustomerSnapshot;
  total: number;
}) {
  const isInternalRemito = draft.doc_type === "REMITO" && draft.customer_kind === "INTERNO";
  const recipient = isInternalRemito
    ? {
        customer_id: null,
        customer_name: null,
        customer_tax_id: null,
        customer_tax_condition: null,
      }
    : customerSnapshot;

  return {
    doc_type: draft.doc_type,
    point_of_sale: draft.point_of_sale,
    customer_id: recipient.customer_id,
    technician_id: draft.technician_id || null,
    service_id: isInternalRemito
      ? null
      : draft.doc_type === "REMITO"
        ? draft.service_id || null
        : null,
    customer_name: recipient.customer_name,
    customer_tax_condition: recipient.customer_tax_condition,
    customer_tax_id: recipient.customer_tax_id,
    customer_kind: draft.customer_kind,
    internal_remito_type: isInternalRemito ? draft.internal_remito_type || null : null,
    payment_terms: isInternalRemito ? null : draft.payment_terms || null,
    delivery_address: draft.delivery_address || null,
    salesperson: draft.salesperson || null,
    valid_until: draft.doc_type === "PRESUPUESTO" ? draft.valid_until || null : null,
    price_list_id: draft.price_list_id || null,
    notes: draft.notes || null,
    subtotal: total,
    tax_total: 0,
    total,
  };
}
