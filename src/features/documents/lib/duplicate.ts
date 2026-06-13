import type { CustomerKind, DocStatus, DocType, InternalRemitoType, LinePricingMode } from "../types";
import { formatNumber } from "../utils";

export const DUPLICATE_DOCUMENT_CONFIRMATION =
  "Se creara un borrador nuevo con las mismas lineas y datos principales.";

export type DuplicateDocumentSource = {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_id: string | null;
  technician_id: string | null;
  service_id?: string | null;
  origin_document_id?: string | null;
  customer_name: string | null;
  customer_tax_condition: string | null;
  customer_tax_id: string | null;
  customer_kind: CustomerKind;
  internal_remito_type: InternalRemitoType | null;
  payment_terms: string | null;
  delivery_address: string | null;
  salesperson: string | null;
  valid_until?: string | null;
  price_list_id: string | null;
  notes: string | null;
  subtotal: number;
  discount_total?: number | null;
  tax_total: number;
  total: number;
  external_invoice_number?: string | null;
  external_invoice_date?: string | null;
  external_invoice_status?: "ACTIVE" | "VOIDED" | null;
};

export type DuplicateLineSource = {
  id: string;
  document_id: string;
  line_order: number;
  item_id: string | null;
  sku_snapshot: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  discount_pct?: number | null;
  tax_pct?: number | null;
  pricing_mode: LinePricingMode;
  suggested_unit_price: number;
  base_cost_snapshot: number | null;
  list_flete_pct_snapshot: number | null;
  list_utilidad_pct_snapshot: number | null;
  list_impuesto_pct_snapshot: number | null;
  manual_margin_pct: number | null;
  price_overridden_by: string | null;
  price_overridden_at: string | null;
  line_total: number;
};

export function canDuplicateDocumentType(docType: DocType) {
  return docType === "PRESUPUESTO" || docType === "REMITO";
}

export function assertCanDuplicateDocument(document: Pick<DuplicateDocumentSource, "doc_type">) {
  if (!canDuplicateDocumentType(document.doc_type)) {
    throw new Error("Solo se pueden duplicar presupuestos y remitos");
  }
}

export function buildDuplicateDocumentPayload({
  sourceDocument,
  sourceLines,
  currentDate,
}: {
  sourceDocument: DuplicateDocumentSource;
  sourceLines: DuplicateLineSource[];
  currentDate: string;
}) {
  assertCanDuplicateDocument(sourceDocument);

  const sourceNumber = sourceDocument.document_number === null
    ? null
    : formatNumber(sourceDocument.document_number, sourceDocument.point_of_sale);
  const isInternalRemito = sourceDocument.doc_type === "REMITO" && sourceDocument.customer_kind === "INTERNO";

  return {
    document: {
      doc_type: sourceDocument.doc_type,
      status: "BORRADOR" as const,
      point_of_sale: sourceDocument.point_of_sale,
      document_number: null,
      issue_date: currentDate,
      customer_id: isInternalRemito ? null : sourceDocument.customer_id,
      technician_id: sourceDocument.technician_id,
      service_id: isInternalRemito ? null : sourceDocument.service_id ?? null,
      origin_document_id: null,
      customer_name: isInternalRemito ? null : sourceDocument.customer_name,
      customer_tax_condition: isInternalRemito ? null : sourceDocument.customer_tax_condition,
      customer_tax_id: isInternalRemito ? null : sourceDocument.customer_tax_id,
      customer_kind: sourceDocument.customer_kind,
      internal_remito_type: sourceDocument.internal_remito_type,
      payment_terms: isInternalRemito ? null : sourceDocument.payment_terms,
      delivery_address: sourceDocument.delivery_address,
      salesperson: sourceDocument.salesperson,
      valid_until: sourceDocument.doc_type === "PRESUPUESTO" ? sourceDocument.valid_until ?? null : null,
      price_list_id: sourceDocument.price_list_id,
      source_document_id: sourceDocument.id,
      source_document_type: sourceDocument.doc_type,
      source_document_number_snapshot: sourceNumber,
      notes: sourceDocument.notes,
      subtotal: sourceDocument.subtotal,
      discount_total: sourceDocument.discount_total ?? 0,
      tax_total: sourceDocument.tax_total,
      total: sourceDocument.total,
      external_invoice_number: null,
      external_invoice_date: null,
      external_invoice_status: null,
    },
    lines: sourceLines.map((line) => ({
      document_id: "",
      line_order: line.line_order,
      item_id: line.item_id,
      sku_snapshot: line.sku_snapshot,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_pct: line.discount_pct ?? 0,
      tax_pct: line.tax_pct ?? 0,
      pricing_mode: line.pricing_mode,
      suggested_unit_price: line.suggested_unit_price,
      base_cost_snapshot: line.base_cost_snapshot,
      list_flete_pct_snapshot: line.list_flete_pct_snapshot,
      list_utilidad_pct_snapshot: line.list_utilidad_pct_snapshot,
      list_impuesto_pct_snapshot: line.list_impuesto_pct_snapshot,
      manual_margin_pct: line.manual_margin_pct,
      price_overridden_by: line.price_overridden_by,
      price_overridden_at: line.price_overridden_at,
      line_total: line.line_total,
    })),
    event: {
      event_type: "DUPLICATED_FROM_DOCUMENT",
      payload: {
        source_document_id: sourceDocument.id,
        source_doc_type: sourceDocument.doc_type,
        source_number: sourceNumber,
      },
    },
  };
}
