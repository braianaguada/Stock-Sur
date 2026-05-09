export interface ProductCombo {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProductComboLine {
  id: string;
  combo_id: string;
  item_id: string;
  quantity: number;
  line_order: number;
  notes: string | null;
  created_at: string;
}

export interface ProductComboFormLine {
  item_id: string;
  quantity: number;
  line_order: number;
  notes: string;
}

export interface ProductComboFormState {
  name: string;
  description: string;
  is_active: boolean;
  lines: ProductComboFormLine[];
}

export const EMPTY_PRODUCT_COMBO_LINE: ProductComboFormLine = {
  item_id: "",
  quantity: 1,
  line_order: 1,
  notes: "",
};
