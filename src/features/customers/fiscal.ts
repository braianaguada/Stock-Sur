import type { Customer, CustomerFiscalProfile } from "./types";

const CUSTOMER_FISCAL_VALIDATION_STATUSES = ["PENDING", "VALIDATED_AUTO", "ERROR"] as const;

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

function isValidatedFiscalProfile(profile: CustomerFiscalProfile | null | undefined) {
  return profile?.validation_status === "VALIDATED_AUTO";
}

export function canUseCustomerForInvoiceA(customer: Customer | null | undefined, fiscalProfile: CustomerFiscalProfile | null | undefined) {
  const reasons: string[] = [];

  if (!customer) reasons.push("Factura A exige cliente obligatorio.");
  if (customer?.is_occasional) reasons.push("Factura A no admite cliente ocasional.");
  if (!fiscalProfile) reasons.push("El cliente no tiene perfil fiscal.");
  if (fiscalProfile && !isValidCuitChecksum(fiscalProfile.tax_id)) reasons.push("El perfil fiscal no tiene CUIT valido.");
  if (fiscalProfile && !fiscalProfile.legal_name?.trim()) reasons.push("El perfil fiscal no tiene razon social.");
  if (fiscalProfile && fiscalProfile.taxpayer_status !== "ACTIVO") reasons.push("El CUIT debe estar activo en la constancia oficial.");
  if (fiscalProfile && fiscalProfile.tax_condition !== "RESPONSABLE_INSCRIPTO") {
    reasons.push("Factura A solo se habilita para Responsable Inscripto en esta fase.");
  }
  if (fiscalProfile && fiscalProfile.legal_name_source !== "OFFICIAL") {
    reasons.push("La razon social debe venir de la constancia oficial.");
  }
  if (fiscalProfile && fiscalProfile.tax_condition_source !== "OFFICIAL_DERIVED") {
    reasons.push("La condicion IVA debe derivarse automaticamente de datos oficiales.");
  }
  if (fiscalProfile && !isValidatedFiscalProfile(fiscalProfile)) {
    reasons.push("El perfil fiscal todavia no esta validado automaticamente.");
  }
  if (fiscalProfile?.validation_source && /mock|fixture|test/i.test(fiscalProfile.validation_source)) {
    reasons.push("Los perfiles mock no habilitan Factura A.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
function getInvoiceAReadinessReasons(customer: Customer | null | undefined, fiscalProfile: CustomerFiscalProfile | null | undefined) {
  return canUseCustomerForInvoiceA(customer, fiscalProfile).reasons;
}

export function buildCustomerFiscalSnapshot(customer: Customer, fiscalProfile: CustomerFiscalProfile) {
  return {
    customer_id: customer.id,
    legal_name: fiscalProfile.legal_name,
    tax_id: fiscalProfile.tax_id,
    tax_condition: fiscalProfile.tax_condition,
    fiscal_address: fiscalProfile.fiscal_address,
    validation_status: fiscalProfile.validation_status,
    validation_source: fiscalProfile.validation_source,
    tax_condition_source: fiscalProfile.tax_condition_source,
    legal_name_source: fiscalProfile.legal_name_source,
    taxpayer_status: fiscalProfile.taxpayer_status,
    validated_at: fiscalProfile.validated_at,
    snapshot_created_at: new Date().toISOString(),
  };
}
