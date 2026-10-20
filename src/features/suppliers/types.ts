import type {
  ContentUnit,
  SemanticDetection,
} from "@/lib/importers/catalogImporter";
import type { TaxTreatment } from "@/lib/importers/catalogImporter";

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  default_currency: "ARS" | "USD" | null;
  notes: string | null;
  is_active: boolean;
}

export interface SupplierFormState {
  name: string;
  legal_name: string;
  tax_id: string;
  contact_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  notes: string;
}

export interface SupplierCatalog {
  id: string;
  title: string;
  created_at: string;
}

export interface SupplierCatalogVersion {
  id: string;
  catalog_id: string;
  title: string | null;
  imported_at: string;
  supplier_document_id: string;
  file_name: string;
  file_type: string;
  line_count: number;
}

export interface CatalogLine {
  id: string;
  supplier_code: string | null;
  raw_description: string;
  cost: number;
  currency: "ARS" | "USD";
  product_name?: string | null;
  additional_description?: string | null;
  presentation_raw?: string | null;
  package_quantity?: number | null;
  content_value?: number | null;
  content_unit?: ContentUnit | null;
  reference_unit_price?: number | null;
  reference_price_basis?: string | null;
  semantic_detection?: SemanticDetection;
  tax_treatment: TaxTreatment;
  matched_item_id?: string | null;
}

export type SupplierReorderMatchReason = "CONFIRMED" | "SKU" | "EXACT_NAME";

export interface SupplierReorderSuggestion {
  line: CatalogLine;
  itemId: string;
  itemName: string;
  itemSku: string;
  stock: number;
  averageMonthlyOut: number;
  daysOfCover: number;
  suggestedQuantity: number;
  matchReason: SupplierReorderMatchReason;
}

export interface OrderLine extends CatalogLine {
  quantity: number;
}
