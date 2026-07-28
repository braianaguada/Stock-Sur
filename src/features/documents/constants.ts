import type { CustomerKind, DocStatus, DocType, InternalRemitoType, LineDraft, LinePricingMode } from "./types";

export const DOC_LABEL: Record<DocType, string> = {
  PRESUPUESTO: "Presupuesto",
  REMITO: "Remito",
  REMITO_DEVOLUCION: "Devolucion de remito",
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};

export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  GENERAL: "Cliente general",
  INTERNO: "Personal / tecnico interno",
  EMPRESA: "Empresa",
};

export const INTERNAL_REMITO_LABEL: Record<InternalRemitoType, string> = {
  CUENTA_CORRIENTE: "Cuenta corriente",
  DESCUENTO_SUELDO: "Descuento de sueldo",
};

export const PRICING_MODE_LABEL: Record<LinePricingMode, string> = {
  LIST_PRICE: "Precio lista",
  MANUAL_MARGIN: "Margen manual",
  MANUAL_PRICE: "Precio manual",
};

export const EMPTY_LINE: LineDraft = {
  item_id: null,
  sku_snapshot: "",
  description: "",
  unit: "un",
  quantity: 1,
  unit_price: 0,
  pricing_mode: "MANUAL_PRICE",
  suggested_unit_price: 0,
  base_cost_snapshot: null,
  list_flete_pct_snapshot: null,
  list_utilidad_pct_snapshot: null,
  list_impuesto_pct_snapshot: null,
  manual_margin_pct: null,
  price_overridden_by: null,
  price_overridden_at: null,
};
