export interface Customer {
  id: string;
  company_id: string;
  name: string;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  account_due_days?: number | null;
  is_occasional: boolean;
  fiscal_profile?: CustomerFiscalProfile | null;
}

export interface CustomerFiscalProfile {
  id: string;
  company_id: string;
  customer_id: string;
  tax_id: string;
  legal_name: string | null;
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

export interface CustomerFiscalDiagnostics {
  ok: boolean;
  code: string;
  message: string;
  lookupEnvironment: string;
  billingEnvironment: string;
  wsid: string;
  method: string;
  issuerTaxIdMasked: string;
  warning: string | null;
  taxpayerFound: boolean;
  hasDatosGenerales: boolean;
  hasRegimenGeneral: boolean;
  hasImpuestos: boolean;
  hasMonotributo: boolean;
  taxpayerStatus: string | null;
  legalNameFound: boolean;
  taxCondition: string;
  eligibleForInvoiceA: boolean;
  reason: string | null;
  normalizationReason: string | null;
  availableTaxIds: Array<number | string>;
  availableTaxDescriptions: string[];
}
