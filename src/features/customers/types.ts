export interface Customer {
  id: string;
  company_id: string;
  name: string;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  is_occasional: boolean;
  fiscal_profile?: CustomerFiscalProfile | null;
}

export interface CustomerFiscalProfile {
  id: string;
  company_id: string;
  customer_id: string;
  tax_id: string;
  legal_name: string;
  tax_condition: string | null;
  fiscal_address: string | null;
  taxpayer_status: string | null;
  validation_status: "PENDING" | "VALIDATED_AUTO" | "ERROR";
  validation_source: string | null;
  tax_condition_source: "OFFICIAL_DERIVED" | "UNKNOWN" | null;
  legal_name_source: "OFFICIAL" | "UNKNOWN" | null;
  validation_error: string | null;
  validation_snapshot: unknown | null;
  validated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
