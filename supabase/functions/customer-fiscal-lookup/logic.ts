export const AFIPSDK_BASE_URL = "https://app.afipsdk.com/api/";
export const AFIPSDK_ENVIRONMENT = "dev";
export const AFIPSDK_PADRON_WSID = "ws_sr_constancia_inscripcion";

export type FiscalLookupData = {
  taxId: string;
  legalName: string;
  taxCondition: string;
  fiscalAddress: string | null;
  taxpayerStatus: string | null;
  status: "VALIDATED_AUTO";
  source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION";
  taxConditionSource: "OFFICIAL_DERIVED" | "UNKNOWN";
  legalNameSource: "OFFICIAL" | "UNKNOWN";
  eligibleForInvoiceA: boolean;
  reason: string | null;
  snapshot: unknown;
  diagnostics: FiscalLookupDiagnostics;
};

export type FiscalLookupErrorCode =
  | "TAX_CONDITION_UNKNOWN"
  | "TAXPAYER_NOT_FOUND"
  | "TAXPAYER_INACTIVE"
  | "AFIPSDK_ERROR"
  | "SERVICE_NOT_ENABLED"
  | "INVALID_TAX_ID"
  | "LOOKUP_ENVIRONMENT_MISMATCH";

export type FiscalLookupDiagnostics = {
  ok: boolean;
  code: FiscalLookupErrorCode | "VALIDATED_AUTO";
  message: string;
  lookupEnvironment: string;
  wsid: typeof AFIPSDK_PADRON_WSID;
  method: "getPersona_v2";
  taxpayerFound: boolean;
  hasDatosGenerales: boolean;
  hasRegimenGeneral: boolean;
  hasImpuestos: boolean;
  hasMonotributo: boolean;
  taxpayerStatus: string | null;
  legalNameFound: boolean;
  taxCondition: string;
  normalizationReason: string | null;
  availableTaxIds: Array<number | string>;
  availableTaxDescriptions: string[];
};

export function normalizeAfipSdkBaseUrl(value: string | undefined | null) {
  const baseUrl = (value ?? AFIPSDK_BASE_URL).trim() || AFIPSDK_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function normalizeAfipSdkEnvironment(value: string | undefined | null) {
  return (value ?? AFIPSDK_ENVIRONMENT).trim() || AFIPSDK_ENVIRONMENT;
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

export function buildAfipSdkAuthPayload(taxId: string, environment = AFIPSDK_ENVIRONMENT) {
  return {
    environment,
    tax_id: taxId,
    wsid: AFIPSDK_PADRON_WSID,
  };
}

export function buildAfipSdkPadronPayload(params: {
  token: string;
  sign: string;
  issuerTaxId: string;
  taxId: string;
  environment?: string;
}) {
  return {
    environment: params.environment ?? AFIPSDK_ENVIRONMENT,
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

function isCuitText(value: string) {
  return /^\d{10,13}$/.test(value.replace(/\D/g, ""));
}

function sanitizeTaxDescription(value: unknown) {
  const text = firstText(value)
    .replace(/[^\w\s().,/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function joinText(...values: unknown[]) {
  return values.map((value) => String(value ?? "").trim()).filter(Boolean).join(" ");
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

function collectNestedObjects(root: unknown, keyPattern: RegExp): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const object = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(object)) {
      if (value && typeof value === "object") {
        if (keyPattern.test(key)) result.push(value as Record<string, unknown>);
        queue.push(value);
      }
    }
  }
  return result;
}

function findFirstNestedText(root: unknown, keyPattern: RegExp) {
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const object = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(object)) {
      if (keyPattern.test(key)) {
        const text = firstText(value);
        if (text) return text;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return "";
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

function isActiveStatus(value: unknown) {
  const text = firstText(value).toUpperCase();
  return !text || text === "ACTIVO" || text === "A";
}

function getTaxpayerStatus(response: unknown) {
  return firstText(findFirstNestedText(response, /^estadoClave$/i)) || null;
}

function getResponseRoot(response: unknown) {
  const object = asObject(response);
  const result = asObject(object.result);
  const data = asObject(object.data);
  return firstObject(
    object.personaReturn,
    result.personaReturn,
    data.personaReturn,
    object.getPersona_v2Return,
    result.getPersona_v2Return,
    data.getPersona_v2Return,
    result,
    data,
    response,
  );
}

function firstObject(...values: unknown[]) {
  for (const value of values) {
    if (value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0) {
      return value;
    }
  }
  return {};
}

function getDatosGenerales(response: unknown) {
  return findNestedObject(getResponseRoot(response), "datosGenerales");
}

function getDatosRegimenGeneral(response: unknown) {
  return findNestedObject(getResponseRoot(response), "datosRegimenGeneral");
}

function getDatosMonotributo(response: unknown) {
  return findNestedObject(getResponseRoot(response), "datosMonotributo");
}

function getImpuestos(response: unknown) {
  const regimen = getDatosRegimenGeneral(response);
  const monotributo = getDatosMonotributo(response);
  const items = [
    ...asArray(regimen.impuesto),
    ...asArray(regimen.impuestos),
    ...asArray(monotributo.impuesto),
    ...asArray(monotributo.impuestos),
    ...collectNestedArrays(getResponseRoot(response), /^impuestos?$/i),
  ];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getTaxItemId(item: unknown) {
  const object = asObject(item);
  const raw = object.idImpuesto ?? object.codigoImpuesto ?? object.id ?? object.codigo;
  const text = firstText(raw);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) && text.trim() === String(numeric) ? numeric : text;
}

function getTaxItemDescription(item: unknown) {
  const object = asObject(item);
  return sanitizeTaxDescription(
    object.descripcionImpuesto ?? object.descImpuesto ?? object.descripcion ?? object.nombre ?? object.detalle,
  );
}

export function normalizeTaxConditionFromConstancia(response: unknown) {
  const root = getResponseRoot(response);
  const datosGenerales = getDatosGenerales(root);
  const datosRegimenGeneral = getDatosRegimenGeneral(root);
  const datosMonotributo = getDatosMonotributo(root);
  const impuestos = getImpuestos(root);
  const activeImpuestos = impuestos.filter((item) => isActiveStatus(asObject(item).estadoImpuesto));
  const availableTaxIds = activeImpuestos.map(getTaxItemId).filter((value): value is number | string => value !== null);
  const availableTaxDescriptions = activeImpuestos.map(getTaxItemDescription).filter(Boolean);
  const hasDatosGenerales = Object.keys(datosGenerales).length > 0;
  const hasRegimenGeneral = Object.keys(datosRegimenGeneral).length > 0;
  const hasMonotributo = Object.keys(datosMonotributo).length > 0;
  const hasImpuestos = activeImpuestos.length > 0;
  const taxpayerFound = hasDatosGenerales || hasRegimenGeneral || hasMonotributo || hasImpuestos;
  const taxpayerStatus = getTaxpayerStatus(response);

  if (!taxpayerFound) {
    return {
      code: "TAXPAYER_NOT_FOUND" as const,
      taxCondition: "UNKNOWN",
      taxConditionSource: "UNKNOWN" as const,
      eligibleForInvoiceA: false,
      reason: "El CUIT no existe en el padron consultado o el ambiente no devolvio datos utiles.",
      taxpayerStatus,
      taxpayerFound,
      hasDatosGenerales,
      hasRegimenGeneral,
      hasImpuestos,
      hasMonotributo,
      availableTaxIds,
      availableTaxDescriptions,
    };
  }

  if (taxpayerStatus && taxpayerStatus.toUpperCase() !== "ACTIVO") {
    return {
      code: "TAXPAYER_INACTIVE" as const,
      taxCondition: "UNKNOWN",
      taxConditionSource: "UNKNOWN" as const,
      eligibleForInvoiceA: false,
      reason: "CUIT no activo",
      taxpayerStatus,
      taxpayerFound,
      hasDatosGenerales,
      hasRegimenGeneral,
      hasImpuestos,
      hasMonotributo,
      availableTaxIds,
      availableTaxDescriptions,
    };
  }

  if (hasMonotributo) {
    return {
      code: "VALIDATED_AUTO" as const,
      taxCondition: "MONOTRIBUTO",
      taxConditionSource: "OFFICIAL_DERIVED" as const,
      eligibleForInvoiceA: false,
      reason: "Monotributo no habilita Factura A en esta fase",
      taxpayerStatus,
      taxpayerFound,
      hasDatosGenerales,
      hasRegimenGeneral,
      hasImpuestos,
      hasMonotributo,
      availableTaxIds,
      availableTaxDescriptions,
    };
  }

  const labels = activeImpuestos.map((item) => {
    const object = asObject(item);
    return firstText(object.descripcionImpuesto, object.descImpuesto, object.descripcion, object.nombre, object.idImpuesto);
  }).join(" ").toUpperCase();

  if (/IVA/.test(labels) && /EXENTO/.test(labels)) {
    return {
      code: "VALIDATED_AUTO" as const,
      taxCondition: "IVA_EXENTO",
      taxConditionSource: "OFFICIAL_DERIVED" as const,
      eligibleForInvoiceA: false,
      reason: "IVA exento no habilita Factura A en esta fase",
      taxpayerStatus,
      taxpayerFound,
      hasDatosGenerales,
      hasRegimenGeneral,
      hasImpuestos,
      hasMonotributo,
      availableTaxIds,
      availableTaxDescriptions,
    };
  }
  if (activeImpuestos.some((item) => String(getTaxItemId(item)) === "30") || /\bIVA\b/.test(labels)) {
    return {
      code: "VALIDATED_AUTO" as const,
      taxCondition: "RESPONSABLE_INSCRIPTO",
      taxConditionSource: "OFFICIAL_DERIVED" as const,
      eligibleForInvoiceA: true,
      reason: null,
      taxpayerStatus,
      taxpayerFound,
      hasDatosGenerales,
      hasRegimenGeneral,
      hasImpuestos,
      hasMonotributo,
      availableTaxIds,
      availableTaxDescriptions,
    };
  }
  return {
    code: "TAX_CONDITION_UNKNOWN" as const,
    taxCondition: "UNKNOWN",
    taxConditionSource: "UNKNOWN" as const,
    eligibleForInvoiceA: false,
    reason: hasImpuestos
      ? "ARCA devolvio impuestos, pero ninguno permite determinar la condicion IVA."
      : "ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.",
    taxpayerStatus,
    taxpayerFound,
    hasDatosGenerales,
    hasRegimenGeneral,
    hasImpuestos,
    hasMonotributo,
    availableTaxIds,
    availableTaxDescriptions,
  };
}

export function inferTaxCondition(response: unknown) {
  const normalized = normalizeTaxConditionFromConstancia(response);
  return normalized.taxCondition === "UNKNOWN" ? null : normalized.taxCondition;
}

function inferLegalName(response: unknown) {
  const personas = [
    getDatosGenerales(response),
    ...collectNestedObjects(getResponseRoot(response), /persona|contribuyente|sujeto/i),
  ];

  for (const persona of personas) {
    const legalName = firstText(
      persona.razonSocial,
      persona.denominacion,
      persona.nombreCompleto,
      persona.apellidoNombre,
      persona.nombreApellido,
      joinText(persona.apellido, persona.nombre),
      joinText(persona.apellidos, persona.nombres),
    );
    if (legalName && !isCuitText(legalName)) return legalName;
  }

  const nestedLegalName = findFirstNestedText(response, /^(razonSocial|denominacion|nombreCompleto|apellidoNombre|nombreApellido)$/i);
  return nestedLegalName && !isCuitText(nestedLegalName) ? nestedLegalName : "";
}

export function buildFiscalLookupDiagnostics(params: {
  response: unknown;
  lookupEnvironment?: string | null;
  code?: FiscalLookupErrorCode | "VALIDATED_AUTO";
  message?: string | null;
  taxCondition?: string | null;
}) {
  const normalizedCondition = normalizeTaxConditionFromConstancia(params.response);
  const legalName = inferLegalName(params.response);
  const code = params.code ?? normalizedCondition.code;
  return {
    ok: code === "VALIDATED_AUTO",
    code,
    message: params.message ?? normalizedCondition.reason ?? "Perfil fiscal validado automaticamente.",
    lookupEnvironment: normalizeAfipSdkEnvironment(params.lookupEnvironment),
    wsid: AFIPSDK_PADRON_WSID,
    method: "getPersona_v2" as const,
    taxpayerFound: normalizedCondition.taxpayerFound,
    hasDatosGenerales: normalizedCondition.hasDatosGenerales,
    hasRegimenGeneral: normalizedCondition.hasRegimenGeneral,
    hasImpuestos: normalizedCondition.hasImpuestos,
    hasMonotributo: normalizedCondition.hasMonotributo,
    taxpayerStatus: normalizedCondition.taxpayerStatus,
    legalNameFound: Boolean(legalName),
    taxCondition: params.taxCondition ?? normalizedCondition.taxCondition,
    normalizationReason: normalizedCondition.reason,
    availableTaxIds: normalizedCondition.availableTaxIds,
    availableTaxDescriptions: normalizedCondition.availableTaxDescriptions,
  } satisfies FiscalLookupDiagnostics;
}

export function extractFiscalLookupData(taxId: string, response: unknown, lookupEnvironment = AFIPSDK_ENVIRONMENT): FiscalLookupData {
  const domicilio = findNestedObject(response, "domicilioFiscal");
  const legalName = inferLegalName(response);
  const normalizedCondition = normalizeTaxConditionFromConstancia(response);
  const fiscalAddress = firstText(
    domicilio.direccion,
    joinText(domicilio.calle, domicilio.numero, domicilio.localidad, domicilio.descripcionProvincia),
  ) || null;

  if (normalizedCondition.taxCondition === "UNKNOWN") {
    const error = new Error(normalizedCondition.reason ?? "No se pudo determinar automaticamente la condicion IVA.") as Error & {
      fiscalCode?: FiscalLookupErrorCode;
      diagnostics?: FiscalLookupDiagnostics;
    };
    error.fiscalCode = normalizedCondition.code === "VALIDATED_AUTO" ? "TAX_CONDITION_UNKNOWN" : normalizedCondition.code;
    error.diagnostics = buildFiscalLookupDiagnostics({
      response,
      lookupEnvironment,
      code: error.fiscalCode,
      message: error.message,
    });
    throw error;
  }

  return {
    taxId,
    legalName,
    taxCondition: normalizedCondition.taxCondition,
    fiscalAddress,
    taxpayerStatus: normalizedCondition.taxpayerStatus,
    status: "VALIDATED_AUTO",
    source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
    taxConditionSource: normalizedCondition.taxConditionSource,
    legalNameSource: legalName ? "OFFICIAL" : "UNKNOWN",
    eligibleForInvoiceA: normalizedCondition.eligibleForInvoiceA,
    reason: normalizedCondition.reason,
    snapshot: sanitizeProviderPayload(response),
    diagnostics: buildFiscalLookupDiagnostics({ response, lookupEnvironment }),
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
    return "El servicio no esta habilitado para el CUIT emisor o las credenciales de Afip SDK no tienen permisos de padron.";
  }
  if (/bearer|authorization|private key|certificate|secret|token/i.test(raw)) {
    return "Error de credenciales fiscales. Revisar Supabase Secrets.";
  }
  return raw.trim() || "No se pudo validar el CUIT con Afip SDK.";
}
