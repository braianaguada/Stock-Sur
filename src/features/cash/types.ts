import type { CustomerFiscalProfile } from "@/features/customers/types";

export type PaymentMethod =
  | "EFECTIVO"
  | "EFECTIVO_REMITO"
  | "EFECTIVO_FACTURABLE"
  | "SERVICIOS_REMITO"
  | "POINT"
  | "TRANSFERENCIA"
  | "CUENTA_CORRIENTE";
export type ReceiptKind = "PENDIENTE" | "REMITO" | "FACTURA" | "REMITO_DEVOLUCION";
export type SaleStatus = "REGISTRADA" | "PENDIENTE_COMPROBANTE" | "COMPROBANTADA" | "ANULADA";
export type ClosureStatus = "ABIERTO" | "CERRADO";
export type CashExpenseKind = "CAJA" | "CUENTA_CORRIENTE";
export type CashExpenseCategory = "COMIDA" | "INSUMOS" | "ENVIO" | "LIMPIEZA" | "MOVILIDAD" | "OTROS";

export type CustomerOption = {
  id: string;
  name: string;
  cuit: string | null;
};

export type RemitoOption = {
  id: string;
  doc_type: "REMITO" | "REMITO_DEVOLUCION";
  customer_id: string | null;
  customer_name: string;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  created_at: string;
  status: string;
  total: number;
  origin_document_id: string | null;
  source_document_number_snapshot: string | null;
  technician_id: string | null;
  external_invoice_number: string | null;
  external_invoice_status: "ACTIVE" | "VOIDED" | null;
  customers?: {
    id: string;
    company_id: string;
    name: string;
    cuit: string | null;
    email: string | null;
    phone: string | null;
    is_occasional: boolean;
    customer_fiscal_profiles?: CustomerFiscalProfile[] | null;
  } | null;
  technicians?: { name: string | null } | null;
};

export type CashSaleRow = {
  id: string;
  sold_at: string;
  business_date: string;
  amount_total: number;
  payment_method: PaymentMethod;
  receipt_kind: ReceiptKind;
  status: SaleStatus;
  document_id: string | null;
  closure_id: string | null;
  receipt_reference: string | null;
  customer_name_snapshot: string | null;
  notes: string | null;
};

export type CashAdjustmentRow = {
  id: string;
  company_id: string;
  business_date: string;
  occurred_at: string;
  document_id: string;
  adjustment_kind: "REMITO_DEVOLUCION";
  payment_method: "SERVICIOS_REMITO";
  amount_total: number;
  signed_amount: number;
  customer_id: string | null;
  customer_name_snapshot: string | null;
  closure_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CashMovementRow =
  | (CashSaleRow & { movement_kind: "SALE"; display_amount: number })
  | (CashAdjustmentRow & {
      movement_kind: "ADJUSTMENT";
      sold_at: string;
      amount_total: number;
      status: SaleStatus;
      receipt_kind: "REMITO_DEVOLUCION";
      receipt_reference: string | null;
      display_amount: number;
    });

export type CashClosureRow = {
  id: string;
  business_date: string;
  status: ClosureStatus;
  expected_cash_remito_total: number;
  expected_cash_facturable_total: number;
  expected_services_remito_total: number;
  expected_cash_sales_total: number;
  expected_point_sales_total: number;
  expected_transfer_sales_total: number;
  expected_account_sales_total: number;
  expected_cash_expenses_total: number;
  expected_account_expenses_total: number;
  expected_sales_total: number;
  expected_cash_to_render: number;
  expected_non_cash_total: number;
  counted_cash_total: number | null;
  counted_point_total: number | null;
  counted_transfer_total: number | null;
  cash_difference: number | null;
  point_difference: number | null;
  transfer_difference: number | null;
  notes: string | null;
  closed_at: string | null;
};

export type CashExpenseRow = {
  id: string;
  company_id: string;
  business_date: string;
  spent_at: string;
  expense_kind: CashExpenseKind;
  category: CashExpenseCategory;
  amount_total: number;
  description: string;
  has_receipt: boolean;
  receipt_reference: string | null;
  notes: string | null;
  closure_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
};

export type DocumentQuickRow = {
  id: string;
  doc_type: "PRESUPUESTO" | "REMITO" | "REMITO_DEVOLUCION";
  status: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO";
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_name: string;
  total: number;
  notes: string | null;
  origin_document_id?: string | null;
  external_invoice_number: string | null;
  external_invoice_status: "ACTIVE" | "VOIDED" | null;
};

export type DocumentLineQuickRow = {
  id: string;
  line_order: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

export type DocumentEventQuickRow = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

export type CashClosureHistoryRow = Pick<
  CashClosureRow,
  | "id"
  | "business_date"
  | "status"
  | "expected_cash_remito_total"
  | "expected_cash_facturable_total"
  | "expected_services_remito_total"
  | "expected_sales_total"
  | "expected_cash_to_render"
  | "expected_point_sales_total"
  | "expected_transfer_sales_total"
  | "expected_account_sales_total"
  | "expected_account_expenses_total"
  | "expected_cash_expenses_total"
  | "counted_cash_total"
  | "counted_point_total"
  | "counted_transfer_total"
  | "cash_difference"
  | "point_difference"
  | "transfer_difference"
  | "notes"
  | "closed_at"
>;

export type CashSummary = {
  efectivoRemito: number;
  efectivoFacturable: number;
  serviciosRemito: number;
  point: number;
  transferencia: number;
  cuentaCorriente: number;
  total: number;
  pendientes: number;
  gastosTotal: number;
  gastosEfectivo: number;
  gastosNoEfectivo: number;
  efectivoAntesGastos: number;
  efectivoNetoEsperado: number;
};

export type SituationFilter = "TODAS" | "PENDIENTE_CIERRE" | "EN_CAJA_CERRADA" | "POST_CIERRE" | "ANULADA";

export type CashSaleFormState = {
  amount: string;
  paymentMethod: PaymentMethod;
  receiptKind: ReceiptKind;
  customerId: string;
  selectedRemitoId: string;
  receiptReference: string;
  notes: string;
};

export type CashExpenseFormState = {
  businessDate: string;
  category: CashExpenseCategory | "";
  description: string;
  amount: string;
  expenseKind: CashExpenseKind;
  hasReceipt: boolean;
  receiptReference: string;
  notes: string;
};

export type CashPendingReceiptState = {
  selectedSale: CashSaleRow | null;
  pendingReceiptKind: "REMITO" | "FACTURA";
  pendingRemitoId: string;
  pendingReceiptReference: string;
};
