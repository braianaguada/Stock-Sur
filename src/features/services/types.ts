export type ServiceDocumentStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ServiceDocumentCurrency = "ARS" | "USD";
export type ServiceDocumentPricingMode = "DETAILED" | "GLOBAL_TOTAL";
export type ServiceDocumentExchangeRateSource = "BNA" | "MANUAL" | null;

export type ServiceCustomer = {
  id: string;
  name: string;
  cuit: string | null;
  email?: string | null;
  phone?: string | null;
  is_occasional?: boolean;
};

export type ServiceDocument = {
  id: string;
  company_id: string;
  customer_id: string | null;
  customers?: ServiceCustomer | null;
  type: "QUOTE" | "REMITO";
  status: ServiceDocumentStatus;
  number: number;
  reference: string | null;
  issue_date: string;
  valid_until: string | null;
  delivery_time: string | null;
  payment_terms: string | null;
  delivery_location: string | null;
  intro_text: string | null;
  closing_text: string | null;
  subtotal: number | string;
  total: number | string;
  currency: ServiceDocumentCurrency;
  exchange_rate_source: ServiceDocumentExchangeRateSource;
  exchange_rate: number | string | null;
  exchange_rate_date: string | null;
  exchange_rate_fetched_at: string | null;
  exchange_rate_snapshot_label: string | null;
  show_exchange_rate_note: boolean;
  pricing_mode: ServiceDocumentPricingMode;
  global_total: number | string | null;
  hide_line_prices: boolean;
  created_at: string;
  created_by: string | null;
};

export type ServiceDocumentLine = {
  id?: string;
  document_id?: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
  line_type?: "ITEM" | "TITLE" | "SUBTITLE";
};

export type ServiceDocumentForm = {
  customer_id: string;
  status: ServiceDocumentStatus;
  reference: string;
  issue_date: string;
  valid_until: string;
  intro_text: string;
  delivery_time: string;
  payment_terms: string;
  delivery_location: string;
  closing_text: string;
  currency: ServiceDocumentCurrency;
  exchange_rate_source: "BNA" | "MANUAL";
  exchange_rate: string;
  exchange_rate_date: string;
  exchange_rate_fetched_at: string;
  exchange_rate_snapshot_label: string;
  show_exchange_rate_note: boolean;
  pricing_mode: ServiceDocumentPricingMode;
  global_total: string;
  hide_line_prices: boolean;
};

export type ServiceDocumentEvent = {
  id: string;
  document_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
};

export type ServiceDocumentAttachment = {
  id: string;
  company_id?: string;
  service_document_id?: string;
  storage_bucket: "service-document-attachments";
  storage_path: string;
  file_name: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  size_bytes?: number;
  title: string | null;
  description: string | null;
  sort_order: number;
  include_in_print: boolean;
  signed_url?: string | null;
};

export type ServiceDocumentAttachmentDraft = {
  id: string;
  file?: File;
  previewUrl: string;
  storage_path?: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  title: string;
  description: string;
  sort_order: number;
  include_in_print: boolean;
  remove?: boolean;
};

export type ServiceDocumentShareLink = {
  id: string;
  company_id: string;
  service_document_id: string;
  token: string;
  enabled: boolean;
  expires_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
};
