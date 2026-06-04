export const AFIPSDK_BASE_URL = "https://app.afipsdk.com/api/";
export const AFIPSDK_ENVIRONMENT = "dev";
export const AFIPSDK_PADRON_WSID = "ws_sr_constancia_inscripcion";

export type FiscalLookupData = {
  taxId: string;
  legalName: string;
  taxCondition: string | null;
  fiscalAddress: string | null;
  status: "VALIDATED";
  source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION";
  snapshot: unknown;
};

export function normalizeAfipSdkBaseUrl(value: string | undefined | null) {
  const baseUrl = (value ?? AFIPSDK_BASE_URL).trim() || AFIPSDK_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function normalizeCuit(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
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

export function buildAfipSdkAuthPayload(taxId: string) {
  return {
    environment: AFIPSDK_ENVIRONMENT,
    tax_id: taxId,
    wsid: AFIPSDK_PADRON_WSID,
  };
}

export function buildAfipSdkPadronPayload(params: { token: string; sign: string; issuerTaxId: string; taxId: string }) {
  return {
    environment: AFIPSDK_ENVIRONMENT,
    method: "getPersona_v2",
    wsid: AFIPSDK_PADRON_WSID,
    params: {
      token: params.token,
      sign: params.sign,
      cuitRepresentada: Number(params.issuerTaxId),
      idPersona: Number(params.taxId),
    },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function findNestedObject(root: unknown, key: string): Record<string, unknown> {
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const object = current as Record<string, unknown>;
    if (object[key] && typeof object[key] === "object") return object[key] as Record<string, unknown>;
    for (const value of Object.values(object)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return {};
}

function collectNestedArrays(root: unknown, keyPattern: RegExp): unknown[] {
  const result: unknown[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const object = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(object)) {
      if (keyPattern.test(key)) result.push(...asArray(value));
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return result;
}

export function inferTaxCondition(response: unknown) {
  const monotributo = findNestedObject(response, "datosMonotributo");
  if (Object.keys(monotributo).length > 0) return "MONOTRIBUTO";

  const impuestos = collectNestedArrays(response, /impuesto/i);
  const labels = impuestos.map((item) => {
    const object = asObject(item);
    return firstText(object.descripcionImpuesto, object.descImpuesto, object.descripcion, object.nombre, object.idImpuesto);
  }).join(" ").toUpperCase();

  if (/IVA/.test(labels) && /EXENTO/.test(labels)) return "IVA_EXENTO";
  if (/IVA/.test(labels)) return "RESPONSABLE_INSCRIPTO";
  return null;
}

export function extractFiscalLookupData(taxId: string, response: unknown): FiscalLookupData {
  const persona = findNestedObject(response, "datosGenerales");
  const domicilio = findNestedObject(response, "domicilioFiscal");
  const legalName = firstText(
    persona.razonSocial,
    persona.nombre,
    [persona.apellido, persona.nombre].filter(Boolean).join(" "),
  );
  const taxCondition = inferTaxCondition(response);
  const fiscalAddress = firstText(
    domicilio.direccion,
    [domicilio.calle, domicilio.numero, domicilio.localidad, domicilio.descripcionProvincia].filter(Boolean).join(" "),
  ) || null;

  if (!legalName) {
    throw new Error("Afip SDK no devolvio razon social para el CUIT.");
  }
  if (!taxCondition) {
    throw new Error("Afip SDK no devolvio una condicion IVA inferible para el CUIT.");
  }

  return {
    taxId,
    legalName,
    taxCondition,
    fiscalAddress,
    status: "VALIDATED",
    source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
    snapshot: sanitizeProviderPayload(response),
  };
}

export function sanitizeProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProviderPayload);
  if (typeof value === "string") {
    if (/bearer\s+[a-z0-9._~+/=-]+/i.test(value)) return "[REDACTED]";
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(value)) return "[REDACTED]";
    if (/-----BEGIN CERTIFICATE-----/i.test(value)) return "[REDACTED]";
    if (value.length > 4000) return `${value.slice(0, 4000)}...[TRUNCATED]`;
    return value;
  }
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/token|sign|access|authorization|bearer|cert|certificate|private|key|password|secret|cookie/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeProviderPayload(child);
    }
  }
  return sanitized;
}

export function normalizeFiscalLookupError(error: unknown) {
  const errorWithStatus = error as Error & { status?: number | null };
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/rate limit|too many requests|429/i.test(raw) || errorWithStatus.status === 429) {
    return "Afip SDK recibio demasiadas solicitudes. Reintenta luego.";
  }
  if (/timeout|timed out|network|fetch failed/i.test(raw)) {
    return "Afip SDK no respondio a tiempo. Reintenta luego.";
  }
  if (/invalid token|unauthorized|forbidden|401|403/i.test(raw) || [401, 403].includes(Number(errorWithStatus.status))) {
    return "Las credenciales de Afip SDK no son validas o no tienen permisos para padron.";
  }
  if (/bearer|authorization|private key|certificate|secret|token/i.test(raw)) {
    return "Error de credenciales fiscales. Revisar Supabase Secrets.";
  }
  return raw.trim() || "No se pudo validar el CUIT con Afip SDK.";
}
