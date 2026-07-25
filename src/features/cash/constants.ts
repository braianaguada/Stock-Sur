import type {
  DocumentQuickRow,
  CashExpenseCategory,
  CashExpenseKind,
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
  REMITO_DEVOLUCION: "Devolucion / Remito devolucion",
};

export const STATUS_LABEL: Record<SaleStatus, string> = {
  REGISTRADA: "Registrada",
  PENDIENTE_COMPROBANTE: "Sin comprobante",
  COMPROBANTADA: "Con comprobante",
  ANULADA: "Anulada",
};

export const DOC_STATUS_LABEL: Record<DocumentQuickRow["status"], string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};

export const CASH_EXPENSE_CATEGORY_LABEL: Record<CashExpenseCategory, string> = {
  COMIDA: "Comida",
  INSUMOS: "Insumos",
  ENVIO: "Envio",
  LIMPIEZA: "Limpieza",
  MOVILIDAD: "Movilidad",
  OTROS: "Otros",
};

export const CASH_EXPENSE_KIND_LABEL: Record<CashExpenseKind, string> = {
  CAJA: "Efectivo / caja",
  CUENTA_CORRIENTE: "Fuera de caja",
};

export const CASH_EXPENSE_CATEGORIES: CashExpenseCategory[] = [
  "COMIDA",
  "INSUMOS",
  "ENVIO",
  "LIMPIEZA",
  "MOVILIDAD",
  "OTROS",
];
