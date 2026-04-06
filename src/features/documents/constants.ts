import type { CustomerKind, DocStatus, DocType, InternalRemitoType, LineDraft, LinePricingMode } from "./types";

export const DOC_LABEL: Record<DocType, string> = { PRESUPUESTO: "Presupuesto", REMITO: "Remito" };

export const STATUS_LABEL: Record<DocStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};

export const STATUS_VARIANT: Record<DocStatus, "secondary" | "default" | "destructive" | "outline"> = {
  BORRADOR: "secondary",
  ENVIADO: "outline",
  APROBADO: "default",
  RECHAZADO: "destructive",
  EMITIDO: "default",
  ANULADO: "destructive",
};

export const STATUS_CLASS: Record<DocStatus, string> = {
  BORRADOR: "",
  ENVIADO: "border-blue-200 bg-blue-50 text-blue-700",
  APROBADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADO: "",
  EMITIDO: "border-slate-200 bg-slate-900 text-white",
  ANULADO: "",
};

export const DOC_TYPE_CLASS: Record<DocType, string> = {
  PRESUPUESTO: "border-blue-200 bg-blue-50 text-blue-700",
  REMITO: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

export const HISTORY_TONE_CLASS: Record<"neutral" | "info" | "success" | "warning" | "danger", string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export const HISTORY_DOT_CLASS: Record<"neutral" | "info" | "success" | "warning" | "danger", string> = {
  neutral: "bg-slate-400 shadow-slate-200",
  info: "bg-blue-500 shadow-blue-200",
  success: "bg-emerald-500 shadow-emerald-200",
  warning: "bg-amber-500 shadow-amber-200",
  danger: "bg-rose-500 shadow-rose-200",
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
