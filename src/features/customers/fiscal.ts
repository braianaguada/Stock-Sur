import type { Customer, CustomerFiscalProfile } from "./types";

export const CUSTOMER_FISCAL_VALIDATION_STATUSES = ["PENDING", "VALIDATED", "ERROR", "MANUAL_REVIEW"] as const;

export type CustomerFiscalValidationStatus = typeof CUSTOMER_FISCAL_VALIDATION_STATUSES[number];

export function normalizeCuit(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function isValidCuitFormat(value: string | null | undefined) {
  return normalizeCuit(value).length === 11;
}

export function isValidCuitChecksum(value: string | null | undefined) {
  const digits = normalizeCuit(value);
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
  const mod = sum % 11;
  const verifier = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  return verifier === Number(digits[10]);
}

export function getCuitValidationMessage(value: string | null | undefined) {
  const raw = value ?? "";
  if (/[A-Za-z]/.test(raw)) return "El CUIT solo puede contener numeros, guiones o espacios.";

  const normalized = normalizeCuit(raw);
  if (!normalized) return "Ingresá un CUIT.";
  if (normalized.length !== 11) return "El CUIT debe tener 11 digitos.";
  if (!isValidCuitChecksum(normalized)) return "El digito verificador del CUIT no es valido.";
  return null;
}

export function isValidatedFiscalProfile(profile: CustomerFiscalProfile | null | undefined) {
  return profile?.validation_status === "VALIDATED";
}

export function canUseCustomerForInvoiceA(customer: Customer | null | undefined, fiscalProfile: CustomerFiscalProfile | null | undefined) {
  const reasons: string[] = [];

  if (!customer) reasons.push("Factura A exige cliente obligatorio.");
  if (customer?.is_occasional) reasons.push("Factura A no admite cliente ocasional.");
  if (!fiscalProfile) reasons.push("El cliente no tiene perfil fiscal.");
  if (fiscalProfile && !isValidCuitChecksum(fiscalProfile.tax_id)) reasons.push("El perfil fiscal no tiene CUIT valido.");
  if (fiscalProfile && !fiscalProfile.legal_name?.trim()) reasons.push("El perfil fiscal no tiene razon social.");
  if (fiscalProfile && !fiscalProfile.tax_condition?.trim()) reasons.push("El perfil fiscal no tiene condicion IVA.");
  if (fiscalProfile && !isValidatedFiscalProfile(fiscalProfile)) {
    reasons.push("El perfil fiscal todavia no esta validado automaticamente.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export function buildCustomerFiscalSnapshot(customer: Customer, fiscalProfile: CustomerFiscalProfile) {
  return {
    customer_id: customer.id,
    legal_name: fiscalProfile.legal_name,
    tax_id: fiscalProfile.tax_id,
    tax_condition: fiscalProfile.tax_condition,
    fiscal_address: fiscalProfile.fiscal_address,
    validation_status: fiscalProfile.validation_status,
    validated_at: fiscalProfile.validated_at,
    snapshot_created_at: new Date().toISOString(),
  };
}
