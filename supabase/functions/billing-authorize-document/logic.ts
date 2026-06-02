export const AFIPSDK_WSFE = "wsfe";
export const AFIPSDK_ENVIRONMENT = "dev";
export const AFIPSDK_BASE_URL = "https://app.afipsdk.com/api/";
export const AFIPSDK_INVOICE_B_TYPE = 6;
export const AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE = 99;
export const AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER = 0;
export const AFIPSDK_PRODUCTS_CONCEPT = 1;
export const AFIPSDK_ARS_CURRENCY = "PES";
export const AFIPSDK_IVA_21_ID = 5;
export const AFIPSDK_CONDICION_IVA_RECEPTOR_CONSUMIDOR_FINAL = 5;

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
    throw new Error("Solo se admite autorizacion de facturas en esta etapa.");
  }
  if (document.invoice_type !== "FACTURA_B") {
    throw new Error("Solo se admite Factura B en esta etapa.");
  }
  if (!["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"].includes(document.fiscal_status)) {
    throw new Error("El comprobante no esta en un estado autorizable.");
  }
  if (!document.point_of_sale || document.point_of_sale <= 0) {
    throw new Error("El comprobante no tiene punto de venta fiscal configurado.");
  }
  if (!settings || !settings.is_enabled || settings.provider !== "AFIPSDK" || settings.environment !== "dev") {
    throw new Error("La facturacion AFIPSDK dev no esta habilitada para esta empresa.");
  }

  const issuerTaxId = onlyDigits(document.issuer_tax_id ?? settings.issuer_tax_id);
  if (issuerTaxId.length !== 11) {
    throw new Error("Falta CUIT emisor valido en la configuracion de facturacion.");
  }
  if (lines.length === 0) {
    throw new Error("El comprobante no tiene lineas para autorizar.");
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
  if (taxId.length !== 11) throw new Error("Falta CUIT emisor valido para obtener TA de Afip SDK.");

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
}) {
  const { document, settings, lines, tokenAuthorization, voucherNumber, voucherDate } = params;
  const issuerTaxId = onlyDigits(document.issuer_tax_id ?? settings.issuer_tax_id);
  const pointOfSale = Number(document.point_of_sale);
  const subtotal = roundMoney(Number(document.subtotal));
  const taxTotal = roundMoney(Number(document.tax_total));
  const total = roundMoney(Number(document.total));
  const ivaBase = roundMoney(lines.reduce((sum, line) => sum + Number(line.net_amount), 0));
  const ivaAmount = roundMoney(lines.reduce((sum, line) => sum + Number(line.vat_amount), 0));

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
          CbteTipo: AFIPSDK_INVOICE_B_TYPE,
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
            Iva: {
              AlicIva: [{
                Id: AFIPSDK_IVA_21_ID,
                BaseImp: ivaBase,
                Importe: ivaAmount,
              }],
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
      CbteTipo: AFIPSDK_INVOICE_B_TYPE,
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
  if (!value || typeof value !== "object") return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/token|sign|access|authorization|bearer|cert|key|password|secret/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeProviderPayload(child);
    }
  }
  return sanitized;
}
