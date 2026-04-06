import type {
  DocumentQuickRow,
  PaymentMethod,
  ReceiptKind,
  SaleStatus,
} from "./types";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  EFECTIVO_REMITO: "Efectivo remito",
  EFECTIVO_FACTURABLE: "Efectivo facturable",
  SERVICIOS_REMITO: "Servicios / remito",
  POINT: "Point",
  TRANSFERENCIA: "Transferencia",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

export const RECEIPT_LABEL: Record<ReceiptKind, string> = {
  PENDIENTE: "Definir despues",
  REMITO: "Remito",
  FACTURA: "Factura",
};

export const STATUS_LABEL: Record<SaleStatus, string> = {
  REGISTRADA: "Registrada",
  PENDIENTE_COMPROBANTE: "Sin comprobante",
  COMPROBANTADA: "Con comprobante",
  ANULADA: "Anulada",
};

export const STATUS_CLASS: Record<SaleStatus, string> = {
  REGISTRADA: "bg-slate-100 text-slate-700 border-slate-200",
  PENDIENTE_COMPROBANTE: "bg-amber-100 text-amber-700 border-amber-200",
  COMPROBANTADA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ANULADA: "bg-rose-100 text-rose-700 border-rose-200",
};

export const DOC_STATUS_LABEL: Record<DocumentQuickRow["status"], string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};
