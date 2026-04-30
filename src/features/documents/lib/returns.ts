import type { CustomerKind, DocStatus, DocType, InternalRemitoType, LinePricingMode } from "../types";

export type ReturnDocument = {
  id: string;
  company_id?: string | null;
  doc_type: DocType;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  customer_id: string | null;
  technician_id: string | null;
  origin_document_id?: string | null;
  customer_name: string | null;
  customer_tax_condition: string | null;
  customer_tax_id: string | null;
  customer_kind: CustomerKind;
  internal_remito_type: InternalRemitoType | null;
  payment_terms: string | null;
  delivery_address: string | null;
  salesperson: string | null;
  price_list_id: string | null;
  notes: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
};

export type ReturnLine = {
  document_id: string;
  line_order: number;
  item_id: string | null;
  sku_snapshot: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  pricing_mode: LinePricingMode;
  suggested_unit_price: number;
  base_cost_snapshot: number | null;
  list_flete_pct_snapshot: number | null;
  list_utilidad_pct_snapshot: number | null;
  list_impuesto_pct_snapshot: number | null;
  manual_margin_pct: number | null;
  price_overridden_by: string | null;
  price_overridden_at: string | null;
  discount_pct?: number | null;
  line_total: number;
};

export type ReturnDraftPayload = {
  document: {
    doc_type: "REMITO_DEVOLUCION";
    status: "BORRADOR";
    point_of_sale: number;
    customer_id: string | null;
    technician_id: string;
    customer_name: string | null;
    customer_tax_condition: string | null;
    customer_tax_id: string | null;
    customer_kind: CustomerKind;
    internal_remito_type: InternalRemitoType | null;
    payment_terms: string | null;
    delivery_address: string | null;
    salesperson: string | null;
    price_list_id: string | null;
    origin_document_id: string;
    source_document_id: string;
    source_document_type: "REMITO";
    source_document_number_snapshot: string;
    notes: string | null;
    subtotal: 0;
    tax_total: 0;
    total: 0;
  };
  lines: ReturnLine[];
};

export function sumQuantitiesByItem(lines: Pick<ReturnLine, "item_id" | "quantity">[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.item_id) continue;
    totals.set(line.item_id, (totals.get(line.item_id) ?? 0) + Number(line.quantity || 0));
  }
  return totals;
}

export function calculateReturnAvailability({
  originLines,
  previousReturnLines,
}: {
  originLines: Pick<ReturnLine, "item_id" | "quantity">[];
  previousReturnLines: Pick<ReturnLine, "item_id" | "quantity">[];
}) {
  const originalByItem = sumQuantitiesByItem(originLines);
  const returnedByItem = sumQuantitiesByItem(previousReturnLines);
  const availableByItem = new Map<string, { original: number; returned: number; available: number }>();

  for (const [itemId, original] of originalByItem) {
    const returned = returnedByItem.get(itemId) ?? 0;
    availableByItem.set(itemId, {
      original,
      returned,
      available: original - returned,
    });
  }

  return availableByItem;
}

export function validateReturnDocument({
  returnDocument,
  originDocument,
  originLines,
  previousReturnLines,
  newReturnLines,
}: {
  returnDocument: Pick<ReturnDocument, "origin_document_id" | "technician_id">;
  originDocument: Pick<ReturnDocument, "id" | "doc_type" | "status" | "technician_id"> | null;
  originLines: Pick<ReturnLine, "item_id" | "quantity" | "description">[];
  previousReturnLines: Pick<ReturnLine, "item_id" | "quantity">[];
  newReturnLines: Pick<ReturnLine, "item_id" | "quantity" | "description">[];
}) {
  if (!returnDocument.origin_document_id) {
    throw new Error("La devolucion debe referenciar un remito original");
  }
  if (!returnDocument.technician_id) {
    throw new Error("La devolucion debe estar asociada a un tecnico");
  }
  if (!originDocument || originDocument.id !== returnDocument.origin_document_id) {
    throw new Error("La devolucion debe referenciar un remito original");
  }
  if (originDocument.doc_type !== "REMITO" || originDocument.status !== "EMITIDO") {
    throw new Error("La devolucion debe referenciar un remito emitido");
  }
  if (originDocument.technician_id !== returnDocument.technician_id) {
    throw new Error("La devolucion debe referenciar un remito del mismo tecnico");
  }

  const availableByItem = calculateReturnAvailability({ originLines, previousReturnLines });

  for (const line of newReturnLines) {
    if (!line.item_id) throw new Error("La devolucion requiere item asociado en todas las lineas");
    if (Number(line.quantity || 0) <= 0) throw new Error("Cantidad invalida en una linea de la devolucion");

    const availability = availableByItem.get(line.item_id) ?? { original: 0, returned: 0, available: 0 };
    if (line.quantity > availability.available) {
      throw new Error(
        `La devolucion supera lo disponible para ${line.description || "item"} (original: ${availability.original}, ya devuelto: ${availability.returned}, maximo: ${availability.available}, solicitado: ${line.quantity})`,
      );
    }
  }

  return { ok: true as const, availableByItem };
}

export function buildReturnDraftPayload({
  originDocument,
  originLines,
  sourceNumber,
}: {
  originDocument: ReturnDocument;
  originLines: ReturnLine[];
  sourceNumber: string;
}): ReturnDraftPayload {
  if (originDocument.doc_type !== "REMITO" || originDocument.status !== "EMITIDO") {
    throw new Error("La devolucion debe generarse desde un remito emitido");
  }
  if (!originDocument.technician_id) {
    throw new Error("La devolucion debe estar asociada a un tecnico");
  }

  return {
    document: {
      doc_type: "REMITO_DEVOLUCION",
      status: "BORRADOR",
      point_of_sale: originDocument.point_of_sale,
      customer_id: originDocument.customer_id,
      technician_id: originDocument.technician_id,
      customer_name: originDocument.customer_name,
      customer_tax_condition: originDocument.customer_tax_condition,
      customer_tax_id: originDocument.customer_tax_id,
      customer_kind: originDocument.customer_kind,
      internal_remito_type: originDocument.internal_remito_type,
      payment_terms: originDocument.payment_terms,
      delivery_address: originDocument.delivery_address,
      salesperson: originDocument.salesperson,
      price_list_id: originDocument.price_list_id,
      origin_document_id: originDocument.id,
      source_document_id: originDocument.id,
      source_document_type: "REMITO",
      source_document_number_snapshot: sourceNumber,
      notes: originDocument.notes,
      subtotal: 0,
      tax_total: 0,
      total: 0,
    },
    lines: originLines.map((line) => ({
      ...line,
      document_id: "",
      quantity: line.quantity,
      line_total: 0,
    })),
  };
}
