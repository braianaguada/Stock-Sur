export interface Customer {
  id: string;
  company_id: string;
  name: string;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  is_occasional: boolean;
}

export type CustomerAccountEntry = {
  id: string;
  business_date: string;
  entry_type: "DEBIT" | "CREDIT";
  origin_type: "DOCUMENT" | "CASH_SALE" | "MANUAL";
  origin_id: string;
  amount: number;
  currency: string;
  description: string;
  notes: string | null;
  created_at: string;
};

export type CustomerAccountSummary = {
  company_id: string;
  customer_id: string;
  balance: number;
  movements_count: number;
  last_movement_at: string | null;
  last_entry_type: "DEBIT" | "CREDIT" | null;
  last_origin_type: "DOCUMENT" | "CASH_SALE" | "MANUAL" | null;
  last_origin_id: string | null;
  last_amount: number | null;
};
