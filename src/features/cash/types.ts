export type PaymentMethod =
  | "EFECTIVO"
  | "EFECTIVO_REMITO"
  | "EFECTIVO_FACTURABLE"
  | "SERVICIOS_REMITO"
  | "POINT"
  | "TRANSFERENCIA"
  | "CUENTA_CORRIENTE";
export type ReceiptKind = "PENDIENTE" | "REMITO" | "FACTURA";
export type SaleStatus = "REGISTRADA" | "PENDIENTE_COMPROBANTE" | "COMPROBANTADA" | "ANULADA";
export type ClosureStatus = "ABIERTO" | "CERRADO";

export type CustomerOption = {
  id: string;
  name: string;
  cuit: string | null;
  is_occasional: boolean;
};

export type RemitoOption = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  created_at: string;
  status: string;
  total: number;
  external_invoice_number: string | null;
  external_invoice_status: "ACTIVE" | "VOIDED" | null;
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
  expected_sales_total: number;
  expected_cash_to_render: number;
  counted_cash_total: number | null;
  counted_point_total: number | null;
  counted_transfer_total: number | null;
  cash_difference: number | null;
  point_difference: number | null;
  transfer_difference: number | null;
  notes: string | null;
  closed_at: string | null;
};

export type DocumentQuickRow = {
  id: string;
  doc_type: "PRESUPUESTO" | "REMITO";
  status: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO";
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_name: string;
  total: number;
  notes: string | null;
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

export type CashPendingReceiptState = {
  selectedSale: CashSaleRow | null;
  pendingReceiptKind: ReceiptKind;
  pendingRemitoId: string;
  pendingReceiptReference: string;
};
