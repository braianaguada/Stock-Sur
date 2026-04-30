export type DocType = "PRESUPUESTO" | "REMITO" | "REMITO_DEVOLUCION";
export type DocStatus = "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO";
export type CustomerKind = "GENERAL" | "INTERNO" | "EMPRESA";
export type InternalRemitoType = "CUENTA_CORRIENTE" | "DESCUENTO_SUELDO";
export type LinePricingMode = "LIST_PRICE" | "MANUAL_MARGIN" | "MANUAL_PRICE";

export interface LineDraft {
  item_id: string | null;
  sku_snapshot: string;
  description: string;
  unit: string;
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
}

export interface DocumentFormState {
  doc_type: DocType;
  point_of_sale: number;
  customer_id: string;
  customer_name: string;
  customer_tax_condition: string;
  customer_tax_id: string;
  customer_kind: CustomerKind;
  internal_remito_type: InternalRemitoType | "";
  payment_terms: string;
  delivery_address: string;
  salesperson: string;
  valid_until: string;
  price_list_id: string;
  notes: string;
}

export interface DocRow {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_tax_condition: string | null;
  customer_kind: CustomerKind;
  internal_remito_type: InternalRemitoType | null;
  payment_terms: string | null;
  delivery_address: string | null;
  salesperson: string | null;
  valid_until: string | null;
  price_list_id: string | null;
  source_document_id: string | null;
  source_document_type: DocType | null;
  source_document_number_snapshot: string | null;
  external_invoice_number: string | null;
  external_invoice_date: string | null;
  external_invoice_status: "ACTIVE" | "VOIDED" | null;
  notes: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  created_at: string;
}

export interface DocLineRow {
  id: string;
  item_id: string | null;
  line_order: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  sku_snapshot: string | null;
  pricing_mode: LinePricingMode;
  suggested_unit_price: number;
  base_cost_snapshot: number | null;
  list_flete_pct_snapshot: number | null;
  list_utilidad_pct_snapshot: number | null;
  list_impuesto_pct_snapshot: number | null;
  manual_margin_pct: number | null;
  price_overridden_by: string | null;
  price_overridden_at: string | null;
}

export interface DocEventRow {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
}

export interface PriceListRow {
  id: string;
  name: string;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  round_mode: "none" | "integer" | "tens" | "hundreds" | "x99";
  round_to: number | null;
}

export interface PriceListItemRow {
  item_id: string;
  is_active: boolean;
  base_cost: number;
  calculated_price: number;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  final_price_override: number | null;
  items: {
    id: string;
    sku: string;
    name: string;
    attributes?: string | null;
    brand?: string | null;
    model?: string | null;
    unit: string;
  } | null;
}
