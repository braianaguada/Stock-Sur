export type ServiceDocumentStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ServiceCustomer = {
  id: string;
  name: string;
  cuit: string | null;
  email?: string | null;
  phone?: string | null;
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
  currency: string;
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
  currency: string;
};

export type ServiceDocumentEvent = {
  id: string;
  document_id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
};
