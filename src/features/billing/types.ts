export type BillingInvoiceType = "FACTURA_B";
export type BillingFiscalStatus = "DRAFT" | "READY_TO_AUTHORIZE" | "AUTHORIZED" | "REJECTED" | "CANCELLED_INTERNAL";

export type BillingSettingsRow = {
  id: string;
  company_id: string;
  provider: "AFIPSDK";
  environment: "dev" | "prod";
  is_enabled: boolean;
  issuer_tax_id: string | null;
  issuer_name: string | null;
  issuer_tax_condition: string | null;
  notes: string | null;
};

export type BillingDocumentRow = {
  id: string;
  company_id: string;
  source_type: "CASH_SALE_FROM_REMITO";
  source_id: string;
  source_remito_id: string | null;
  document_kind: "INVOICE" | "CREDIT_NOTE";
  invoice_type: BillingInvoiceType;
  fiscal_status: BillingFiscalStatus;
  provider: "AFIPSDK";
  environment: "dev" | "prod";
  receiver_name: string;
  receiver_doc_type: string;
  receiver_doc_number: string | null;
  receiver_tax_condition: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  point_of_sale: number | null;
  voucher_number: number | null;
  voucher_full_number: string | null;
  cae: string | null;
  cae_expires_at: string | null;
  authorized_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingDocumentLineRow = {
  id: string;
  billing_document_id: string;
  source_document_line_id: string | null;
  line_order: number;
  description: string;
  unit: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  discount_total: number;
  vat_rate: number;
  net_amount: number;
  vat_amount: number;
  total: number;
};

export type BillingRemitoReference = {
  id: string;
  point_of_sale: number;
  document_number: number | null;
  customer_name: string | null;
};
