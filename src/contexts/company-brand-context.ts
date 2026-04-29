import { createContext, useContext } from "react";

export interface CompanySettings {
  id: number;
  company_id: string | null;
  app_name: string;
  legal_name: string | null;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  document_tagline: string | null;
  document_footer: string | null;
  service_default_intro_text: string | null;
  service_default_closing_text: string | null;
  service_default_delivery_time: string | null;
  service_default_payment_terms: string | null;
  service_default_delivery_location: string | null;
  service_default_valid_days: number | null;
  default_point_of_sale: number;
  allow_issue_remitos_without_stock: boolean;
  auto_close_cash_enabled: boolean;
  auto_close_cash_time: string | null;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: 1,
  company_id: null,
  app_name: "Stock Sur",
  legal_name: "Stock Sur",
  tax_id: null,
  address: null,
  phone: null,
  whatsapp: null,
  email: null,
  logo_url: null,
  primary_color: "#1f4f99",
  secondary_color: "#c62828",
  accent_color: "#eef3fb",
  document_tagline: "DocumentaciÃ³n comercial",
  document_footer: "Este documento no reemplaza comprobantes fiscales",
  service_default_intro_text: null,
  service_default_closing_text: null,
  service_default_delivery_time: null,
  service_default_payment_terms: null,
  service_default_delivery_location: null,
  service_default_valid_days: null,
  default_point_of_sale: 1,
  allow_issue_remitos_without_stock: false,
  auto_close_cash_enabled: false,
  auto_close_cash_time: null,
};

export interface CompanyBrandContextValue {
  settings: CompanySettings;
  isLoading: boolean;
}

export const CompanyBrandContext = createContext<CompanyBrandContextValue>({
  settings: DEFAULT_COMPANY_SETTINGS,
  isLoading: true,
});

export const useCompanyBrand = () => useContext(CompanyBrandContext);
