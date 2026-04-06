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
  default_point_of_sale: number;
  allow_issue_remitos_without_stock: boolean;
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
  document_tagline: "Documentacion comercial",
  document_footer: "Este documento no reemplaza comprobantes fiscales",
  default_point_of_sale: 1,
  allow_issue_remitos_without_stock: false,
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
