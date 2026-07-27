import { isValidCuitChecksum, isValidCuitFormat, normalizeCuit } from "@/lib/cuit";
import type { Customer, CustomerFiscalProfile } from "./types";

export { isValidCuitChecksum, isValidCuitFormat, normalizeCuit };

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
