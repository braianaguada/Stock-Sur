import type {
  CatalogImportLine,
  NormalizeDiagnostics,
  ParsePdfProgress,
  ParsedSheetData,
} from "@/lib/importers/catalogImporter";

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface SupplierFormState {
  name: string;
  contact_name: string;
  email: string;
  whatsapp: string;
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
  currency: string;
}

export interface OrderLine extends CatalogLine {
  quantity: number;
}

export interface SupplierCatalogLinePayload {
  supplier_code: string | null;
  raw_description: string;
  normalized_description: string | null;
  cost: number;
  currency: string;
  row_index: number;
  matched_item_id: string | null;
  match_status: "MATCHED" | "PENDING" | "NEW";
}

export interface ImportMappingStored {
  descriptionColumn: string;
  priceColumn: string;
  currencyColumn?: string | null;
  supplierCodeColumn?: string | null;
}

export interface PdfImportMappingStored {
  descriptionColumn: string;
  priceColumn: string;
  codeColumn?: string | null;
  preferPriceAtEnd?: boolean;
  filterRowsWithoutPrice?: boolean;
}

export type {
  CatalogImportLine,
  NormalizeDiagnostics,
  ParsePdfProgress,
  ParsedSheetData,
};
