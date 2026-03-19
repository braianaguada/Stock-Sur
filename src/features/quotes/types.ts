export interface QuoteLine {
  description: string;
  quantity: number;
  unit_price: number;
  item_id: string | null;
}

export interface QuoteListRow {
  id: string;
  quote_number: number;
  customer_name: string | null;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  customers?: {
    name?: string | null;
  } | null;
}

export interface QuoteLineRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
