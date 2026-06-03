export const AFIPSDK_WSFE = "wsfe";
export const AFIPSDK_ENVIRONMENT = "dev";
export const AFIPSDK_BASE_URL = "https://app.afipsdk.com/api/";
export const AFIPSDK_INVOICE_B_TYPE = 6;
export const AFIPSDK_CREDIT_NOTE_B_TYPE = 8;
export const AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE = 99;
export const AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER = 0;
export const AFIPSDK_PRODUCTS_CONCEPT = 1;
export const AFIPSDK_ARS_CURRENCY = "PES";
export const AFIPSDK_IVA_0_ID = 3;
export const AFIPSDK_IVA_21_ID = 5;
export const AFIPSDK_CONDICION_IVA_RECEPTOR_CONSUMIDOR_FINAL = 5;
export const STALE_AUTHORIZING_MINUTES = 10;

type BillingDocumentLike = {
  id: string;
  company_id: string;
  document_kind: string;
  invoice_type: string;
  fiscal_status: string;
  provider: string;
  environment: string;
  issuer_tax_id: string | null;
  receiver_doc_type: string;
  receiver_doc_number: string | null;
  subtotal: number | string;
  tax_total: number | string;
  total: number | string;
  point_of_sale: number | null;
  related_billing_document_id?: string | null;
  voucher_number?: number | string | null;
  voucher_date?: string | null;
  cae?: string | null;
};

type RelatedInvoiceLike = {
  id: string;
  company_id: string;
  document_kind: string;
  invoice_type: string;
  fiscal_status: string;
  point_of_sale: number | string | null;
  voucher_number: number | string | null;
  voucher_date: string | null;
  cae: string | null;
};

type LockFailureDocumentLike = {
  fiscal_status: string;
  cae?: string | null;
  voucher_number?: number | string | null;
  updated_at?: string | null;
};

type LockFailureErrorLike = {
  code?: string | null;
  message?: string | null;
};

type BillingSettingsLike = {
  id: string;
  is_enabled: boolean;
  provider: string;
  environment: string;
  issuer_tax_id: string | null;
};

type BillingPointOfSaleLike = {
  point_of_sale: number | string;
  is_enabled: boolean | null;
};

type BillingLineLike = {
  vat_rate: number | string;
  net_amount: number | string;
  vat_amount: number | string;
};

type TokenAuthorization = {
  token: string;
  sign: string;
};

export type AfipSdkAuthorizationResult = {
  cae: string;
  caeExpiresAt: string;
  voucherNumber: number;
  voucherFullNumber: string;
  voucherDate: string;
  errors: unknown[];
  observations: unknown[];
};

export function normalizeAfipSdkBaseUrl(value: string | undefined | null) {
  const baseUrl = (value ?? AFIPSDK_BASE_URL).trim() || AFIPSDK_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function normalizeCuit(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCuitFormat(value: string) {
  return normalizeCuit(value).length === 11;
}

export function isAuthorizableFiscalStatus(status: string) {
  return ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"].includes(status);
}

export function getAuthorizationLockFailureMessage(params: {
  document: LockFailureDocumentLike | null;
  lockError?: LockFailureErrorLike | null;
  now?: Date;
}) {
  const { document, lockError } = params;
  if (!document) return "Comprobante fiscal no encontrado.";

  const status = document.fiscal_status;
  if (status === "AUTHORIZED" || document.cae || document.voucher_number) {
    return "El comprobante ya fue autorizado.";
  }

  if (status === "AUTHORIZING") {
    const now = params.now ?? new Date();
    const updatedAt = document.updated_at ? new Date(document.updated_at) : null;
    const ageMs = updatedAt && Number.isFinite(updatedAt.getTime()) ? now.getTime() - updatedAt.getTime() : null;
    if (ageMs !== null && ageMs > 10 * 60 * 1000) {
      return "La autorizacion quedo trabada. Liberala desde Facturacion antes de reintentar.";
    }
    return "La autorizacion esta en proceso. Espera unos minutos.";
  }

  if (!isAuthorizableFiscalStatus(status)) {
    return `El comprobante no esta en un estado autorizable. Estado actual: ${status}.`;
  }

  if (lockError?.message) {
    const code = lockError.code ? ` (${lockError.code})` : "";
    return `No se pudo bloquear el comprobante para autorizar. Estado actual: ${status}. Error DB${code}: ${lockError.message}`;
  }

  return `No se pudo bloquear el comprobante para autorizar. Estado actual: ${status}.`;
}

export function onlyDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatAfipDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function formatVoucherFullNumber(pointOfSale: number, voucherNumber: number) {
  return `${String(pointOfSale).padStart(5, "0")}-${String(voucherNumber).padStart(8, "0")}`;
}

function resolveAfipVatId(vatRate: number) {
  if (vatRate === 0) return AFIPSDK_IVA_0_ID;
  if (vatRate === 21) return AFIPSDK_IVA_21_ID;
  throw new Error(`Alicuota IVA no soportada para Afip SDK dev: ${vatRate}.`);
}

export function buildAfipSdkVatItems(lines: BillingLineLike[]) {
  const grouped = new Map<number, { base: number; amount: number }>();
  for (const line of lines) {
    const vatRate = Number(line.vat_rate);
    const afipVatId = resolveAfipVatId(vatRate);
    const current = grouped.get(afipVatId) ?? { base: 0, amount: 0 };
    current.base += Number(line.net_amount);
    current.amount += Number(line.vat_amount);
    grouped.set(afipVatId, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([id, values]) => ({
      Id: id,
      BaseImp: roundMoney(values.base),
      Importe: roundMoney(values.amount),
    }));
}

export function assertAuthorizationPreconditions(params: {
  document: BillingDocumentLike | null;
  settings: BillingSettingsLike | null;
  lines: BillingLineLike[];
}) {
  const { document, settings, lines } = params;

  if (!document) throw new Error("Comprobante fiscal no encontrado.");
  if (document.provider !== "AFIPSDK" || document.environment !== "dev") {
    throw new Error("Solo se permite homologacion AFIPSDK dev.");
  }
  if (document.document_kind !== "INVOICE") {
    if (document.document_kind !== "CREDIT_NOTE") {
      throw new Error("Solo se admite autorizacion de Factura B o Nota de Credito B.");
    }
  }
  if (document.document_kind === "INVOICE" && document.invoice_type !== "FACTURA_B") {
    throw new Error("Solo se admite Factura B en esta etapa.");
  }
  if (document.document_kind === "CREDIT_NOTE" && document.invoice_type !== "NOTA_CREDITO_B") {
    throw new Error("Solo se admite Nota de Credito B en esta etapa.");
  }
  if (!isAuthorizableFiscalStatus(document.fiscal_status)) {
    throw new Error("El comprobante no esta en un estado autorizable.");
  }
  if (!document.point_of_sale || document.point_of_sale <= 0) {
    throw new Error("El comprobante no tiene punto de venta fiscal configurado.");
  }
  if (!settings || !settings.is_enabled || settings.provider !== "AFIPSDK" || settings.environment !== "dev") {
    throw new Error("La facturacion AFIPSDK dev no esta habilitada para esta empresa.");
  }

  const issuerTaxId = onlyDigits(document.issuer_tax_id ?? settings.issuer_tax_id);
  if (!issuerTaxId) {
    throw new Error("Configura el CUIT emisor en Configuracion > Facturacion fiscal.");
  }
  if (issuerTaxId.length !== 11) {
    throw new Error("El CUIT emisor debe tener 11 dígitos.");
  }
  if (lines.length === 0) {
    throw new Error("El comprobante no tiene lineas para autorizar.");
  }
}

export function assertCreditNoteRelatedInvoicePreconditions(params: {
  document: BillingDocumentLike;
  relatedInvoice: RelatedInvoiceLike | null;
}) {
  const { document, relatedInvoice } = params;
  if (document.document_kind !== "CREDIT_NOTE") return;

  if (!document.related_billing_document_id) {
    throw new Error("La Nota de Credito B debe estar vinculada a una Factura B autorizada.");
  }
  if (!relatedInvoice) {
    throw new Error("Factura B asociada no encontrada.");
  }
  if (relatedInvoice.company_id !== document.company_id) {
    throw new Error("La Nota de Credito B y la factura asociada deben pertenecer a la misma empresa.");
  }
  if (relatedInvoice.document_kind !== "INVOICE" || relatedInvoice.invoice_type !== "FACTURA_B") {
    throw new Error("La Nota de Credito B debe referenciar una Factura B.");
  }
  if (
    relatedInvoice.fiscal_status !== "AUTHORIZED" ||
    !relatedInvoice.cae ||
    !relatedInvoice.voucher_number ||
    !relatedInvoice.point_of_sale ||
    !relatedInvoice.voucher_date
  ) {
    throw new Error("La Factura B asociada debe estar autorizada y tener numero fiscal, fecha y CAE.");
  }
}

export function resolveAuthorizationPointOfSale(params: {
  document: Pick<BillingDocumentLike, "point_of_sale"> | null;
  pointsOfSale: BillingPointOfSaleLike[];
}) {
  const documentPointOfSale = Number(params.document?.point_of_sale ?? 0);
  const enabledPoints = params.pointsOfSale
    .filter((point) => point.is_enabled !== false)
    .map((point) => Number(point.point_of_sale))
    .filter((point) => Number.isInteger(point) && point > 0);

  if (documentPointOfSale > 0) {
    if (enabledPoints.length > 0 && !enabledPoints.includes(documentPointOfSale)) {
      throw new Error("El punto de venta fiscal seleccionado no esta habilitado.");
    }
    return documentPointOfSale;
  }

  if (enabledPoints.length === 1) return enabledPoints[0];
  if (enabledPoints.length > 1) {
    throw new Error("Hay más de un punto de venta habilitado. Seleccioná uno antes de autorizar.");
  }

  throw new Error("El comprobante no tiene punto de venta fiscal configurado.");
}

export function buildAfipSdkAuthPayload(settings: BillingSettingsLike) {
  const taxId = onlyDigits(settings.issuer_tax_id);
  if (!taxId) throw new Error("Configura el CUIT emisor en Configuracion > Facturacion fiscal.");
  if (taxId.length !== 11) throw new Error("El CUIT emisor debe tener 11 dígitos.");

  return {
    environment: AFIPSDK_ENVIRONMENT,
    tax_id: taxId,
    wsid: AFIPSDK_WSFE,
  };
}

export function buildAfipSdkInvoicePayload(params: {
  document: BillingDocumentLike;
  settings: BillingSettingsLike;
  lines: BillingLineLike[];
  tokenAuthorization: TokenAuthorization;
  voucherNumber: number;
  voucherDate?: Date;
  relatedInvoice?: RelatedInvoiceLike | null;
}) {
  const { document, settings, lines, tokenAuthorization, voucherNumber, voucherDate, relatedInvoice } = params;
  const issuerTaxId = onlyDigits(document.issuer_tax_id ?? settings.issuer_tax_id);
  const pointOfSale = Number(document.point_of_sale);
  const subtotal = roundMoney(Number(document.subtotal));
  const taxTotal = roundMoney(Number(document.tax_total));
  const total = roundMoney(Number(document.total));
  const vatItems = buildAfipSdkVatItems(lines);
  const isCreditNoteB = document.document_kind === "CREDIT_NOTE" && document.invoice_type === "NOTA_CREDITO_B";
  if (isCreditNoteB) {
    assertCreditNoteRelatedInvoicePreconditions({ document, relatedInvoice: relatedInvoice ?? null });
  }

  return {
    environment: AFIPSDK_ENVIRONMENT,
    method: "FECAESolicitar",
    wsid: AFIPSDK_WSFE,
    params: {
      Auth: {
        Token: tokenAuthorization.token,
        Sign: tokenAuthorization.sign,
        Cuit: issuerTaxId,
      },
      FeCAEReq: {
        FeCabReq: {
          CantReg: 1,
          PtoVta: pointOfSale,
          CbteTipo: isCreditNoteB ? AFIPSDK_CREDIT_NOTE_B_TYPE : AFIPSDK_INVOICE_B_TYPE,
        },
        FeDetReq: {
          FECAEDetRequest: {
            Concepto: AFIPSDK_PRODUCTS_CONCEPT,
            DocTipo: AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE,
            DocNro: AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER,
            CbteDesde: voucherNumber,
            CbteHasta: voucherNumber,
            CbteFch: Number(formatAfipDate(voucherDate)),
            ImpTotal: total,
            ImpTotConc: 0,
            ImpNeto: subtotal,
            ImpOpEx: 0,
            ImpIVA: taxTotal,
            ImpTrib: 0,
            MonId: AFIPSDK_ARS_CURRENCY,
            MonCotiz: 1,
            CondicionIVAReceptorId: AFIPSDK_CONDICION_IVA_RECEPTOR_CONSUMIDOR_FINAL,
            ...(isCreditNoteB && relatedInvoice ? {
              CbtesAsoc: {
                CbteAsoc: [{
                  Tipo: AFIPSDK_INVOICE_B_TYPE,
                  PtoVta: Number(relatedInvoice.point_of_sale),
                  Nro: Number(relatedInvoice.voucher_number),
                  CbteFch: Number(String(relatedInvoice.voucher_date).replace(/\D/g, "").slice(0, 8)),
                }],
              },
            } : {}),
            Iva: {
              AlicIva: vatItems,
            },
          },
        },
      },
    },
  };
}

export function buildAfipSdkLastVoucherPayload(params: {
  settings: BillingSettingsLike;
  tokenAuthorization: TokenAuthorization;
  pointOfSale: number;
  invoiceType?: string;
}) {
  const issuerTaxId = onlyDigits(params.settings.issuer_tax_id);
  return {
    environment: AFIPSDK_ENVIRONMENT,
    method: "FECompUltimoAutorizado",
    wsid: AFIPSDK_WSFE,
    params: {
      Auth: {
        Token: params.tokenAuthorization.token,
        Sign: params.tokenAuthorization.sign,
        Cuit: issuerTaxId,
      },
      PtoVta: params.pointOfSale,
      CbteTipo: params.invoiceType === "NOTA_CREDITO_B" ? AFIPSDK_CREDIT_NOTE_B_TYPE : AFIPSDK_INVOICE_B_TYPE,
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

function extractDetailResponse(response: unknown): Record<string, unknown> {
  const root = asObject(response);
  const result = asObject(root.FECAESolicitarResult ?? root.result ?? root);
  const detResp = asObject(result.FeDetResp);
  const detail = detResp.FECAEDetResponse;
  if (Array.isArray(detail)) return asObject(detail[0]);
  return asObject(detail ?? result);
}

export function parseLastVoucherNumber(response: unknown) {
  const root = asObject(response);
  const result = asObject(root.FECompUltimoAutorizadoResult ?? root.result ?? root);
  const value = result.CbteNro ?? root.CbteNro ?? root.last_voucher ?? root.voucher_number ?? 0;
  return Number(value) || 0;
}

function normalizeAfipSdkDate(value: unknown) {
  const text = String(value ?? "");
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return text;
}

export function parseAfipSdkAuthorizationResponse(params: {
  response: unknown;
  pointOfSale: number;
  fallbackVoucherNumber: number;
  voucherDate?: Date;
}): AfipSdkAuthorizationResult {
  const { response, pointOfSale, fallbackVoucherNumber, voucherDate } = params;
  const root = asObject(response);
  const result = asObject(root.FECAESolicitarResult ?? root.result ?? root);
  const detail = extractDetailResponse(response);
  const cae = String(detail.CAE ?? root.CAE ?? "");
  const caeExpiresAt = normalizeAfipSdkDate(detail.CAEFchVto ?? root.CAEFchVto);
  const voucherNumber = Number(detail.CbteDesde ?? root.voucher_number ?? fallbackVoucherNumber);

  if (!cae || !caeExpiresAt || !voucherNumber) {
    throw new Error("Afip SDK no devolvio CAE, vencimiento o numero de comprobante.");
  }

  return {
    cae,
    caeExpiresAt,
    voucherNumber,
    voucherFullNumber: formatVoucherFullNumber(pointOfSale, voucherNumber),
    voucherDate: formatAfipDate(voucherDate).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    errors: asArray(result.Errors ?? root.Errors),
    observations: asArray(detail.Observaciones ?? result.Observaciones ?? root.Observaciones),
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

export function normalizeBillingError(error: unknown) {
  const errorWithStatus = error as Error & { status?: number | null; providerResponse?: unknown };
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const message = rawMessage.trim();

  if (/rate limit|too many requests|429/i.test(message) || errorWithStatus.status === 429) {
    return "Afip SDK recibio demasiadas solicitudes. Espera y reintenta.";
  }
  if (/timeout|timed out|network|fetch failed/i.test(message)) {
    return "Afip SDK no respondio a tiempo. Reintenta luego.";
  }
  if (/invalid token|unauthorized|forbidden|401|403/i.test(message) || [401, 403].includes(Number(errorWithStatus.status))) {
    return "Las credenciales de Afip SDK no son validas o no tienen permisos.";
  }
  if (/bearer|authorization|private key|certificate|secret|token/i.test(message)) {
    return "Error de credenciales fiscales. Revisar Supabase Secrets.";
  }

  return message || "Error inesperado al autorizar con Afip SDK.";
}
