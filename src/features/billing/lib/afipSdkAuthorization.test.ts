import { describe, expect, it } from "vitest";
import {
  AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER,
  AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE,
  AFIPSDK_CREDIT_NOTE_B_TYPE,
  AFIPSDK_IVA_0_ID,
  AFIPSDK_INVOICE_B_TYPE,
  assertCreditNoteRelatedInvoicePreconditions,
  assertAuthorizationPreconditions,
  buildAfipSdkInvoicePayload,
  buildAfipSdkLastVoucherPayload,
  buildAfipSdkAuthPayload,
  buildAfipSdkVatItems,
  getAuthorizationLockFailureMessage,
  isAuthorizableFiscalStatus,
  isValidCuitFormat,
  normalizeBillingError,
  normalizeCuit,
  parseAfipSdkAuthorizationResponse,
  parseLastVoucherNumber,
  resolveAuthorizationPointOfSale,
  sanitizeProviderPayload,
} from "../../../../supabase/functions/billing-authorize-document/logic";

const settings = {
  id: "settings-1",
  is_enabled: true,
  provider: "AFIPSDK",
  environment: "dev",
  issuer_tax_id: "20-12345678-9",
};

const document = {
  id: "billing-doc-1",
  company_id: "company-1",
  document_kind: "INVOICE",
  invoice_type: "FACTURA_B",
  fiscal_status: "DRAFT",
  provider: "AFIPSDK",
  environment: "dev",
  issuer_tax_id: "20-12345678-9",
  receiver_doc_type: "CONSUMIDOR_FINAL",
  receiver_doc_number: "0",
  subtotal: 100,
  tax_total: 21,
  total: 121,
  point_of_sale: 1,
  related_billing_document_id: null,
  voucher_number: null,
  voucher_date: null,
  cae: null,
};

const relatedInvoice = {
  id: "invoice-1",
  company_id: "company-1",
  document_kind: "INVOICE",
  invoice_type: "FACTURA_B",
  fiscal_status: "AUTHORIZED",
  point_of_sale: 1,
  voucher_number: 26444,
  voucher_date: "2026-06-03",
  cae: "86220216018909",
};

const lines = [{
  vat_rate: 21,
  net_amount: 100,
  vat_amount: 21,
}];

describe("Afip SDK authorization logic", () => {
  it("allows DRAFT, READY_TO_AUTHORIZE and REJECTED to be locked for authorization", () => {
    expect(isAuthorizableFiscalStatus("DRAFT")).toBe(true);
    expect(isAuthorizableFiscalStatus("READY_TO_AUTHORIZE")).toBe(true);
    expect(isAuthorizableFiscalStatus("REJECTED")).toBe(true);
    expect(isAuthorizableFiscalStatus("AUTHORIZING")).toBe(false);
    expect(isAuthorizableFiscalStatus("AUTHORIZED")).toBe(false);
  });

  it("returns specific lock failure messages by current fiscal status", () => {
    expect(getAuthorizationLockFailureMessage({
      document: { fiscal_status: "AUTHORIZING", updated_at: "2026-06-02T12:00:00Z" },
      now: new Date("2026-06-02T12:02:00Z"),
    })).toBe("La autorizacion esta en proceso. Espera unos minutos.");

    expect(getAuthorizationLockFailureMessage({
      document: { fiscal_status: "AUTHORIZING", updated_at: "2026-06-02T12:00:00Z" },
      now: new Date("2026-06-02T12:20:00Z"),
    })).toBe("La autorizacion quedo trabada. Liberala desde Facturacion antes de reintentar.");

    expect(getAuthorizationLockFailureMessage({
      document: { fiscal_status: "AUTHORIZED", cae: "70400000000001", voucher_number: 42 },
    })).toBe("El comprobante ya fue autorizado.");

    expect(getAuthorizationLockFailureMessage({
      document: { fiscal_status: "CANCELLED_INTERNAL" },
    })).toBe("El comprobante no esta en un estado autorizable. Estado actual: CANCELLED_INTERNAL.");
  });

  it("returns useful diagnostics when a lock update fails for an otherwise authorizable document", () => {
    expect(getAuthorizationLockFailureMessage({
      document: { fiscal_status: "DRAFT" },
      lockError: { code: "23514", message: "new row violates check constraint" },
    })).toBe("No se pudo bloquear el comprobante para autorizar. Estado actual: DRAFT. Error DB (23514): new row violates check constraint");
  });

  it("normalizes and validates issuer CUIT format", () => {
    expect(normalizeCuit("20-40937847-2")).toBe("20409378472");
    expect(isValidCuitFormat("20409378472")).toBe(true);
    expect(isValidCuitFormat("")).toBe(false);
    expect(isValidCuitFormat("2040937847")).toBe(false);
    expect(isValidCuitFormat("letras")).toBe(false);
    expect(isValidCuitFormat("12345678901")).toBe(true);
  });

  it("validates only Factura B AFIPSDK dev documents", () => {
    expect(() => assertAuthorizationPreconditions({ document, settings, lines })).not.toThrow();
    expect(() => assertAuthorizationPreconditions({
      document: {
        ...document,
        document_kind: "CREDIT_NOTE",
        invoice_type: "NOTA_CREDITO_B",
        related_billing_document_id: relatedInvoice.id,
      },
      settings,
      lines,
    })).not.toThrow();
    expect(() => assertAuthorizationPreconditions({
      document: { ...document, invoice_type: "FACTURA_A" },
      settings,
      lines,
    })).toThrow("La autorizacion de Factura A esta bloqueada");
    expect(() => assertAuthorizationPreconditions({
      document: { ...document, environment: "prod" },
      settings,
      lines,
    })).toThrow("Solo se permite homologacion");
    expect(() => assertAuthorizationPreconditions({
      document: { ...document, fiscal_status: "AUTHORIZED" },
      settings,
      lines,
    })).toThrow("estado autorizable");
  });

  it("validates Nota de Credito B related Factura B preconditions", () => {
    const creditNote = {
      ...document,
      document_kind: "CREDIT_NOTE",
      invoice_type: "NOTA_CREDITO_B",
      related_billing_document_id: relatedInvoice.id,
    };

    expect(() => assertCreditNoteRelatedInvoicePreconditions({ document: creditNote, relatedInvoice })).not.toThrow();
    expect(() => assertCreditNoteRelatedInvoicePreconditions({
      document: creditNote,
      relatedInvoice: { ...relatedInvoice, fiscal_status: "DRAFT", cae: null },
    })).toThrow("debe estar autorizada");
    expect(() => assertCreditNoteRelatedInvoicePreconditions({
      document: { ...creditNote, related_billing_document_id: null },
      relatedInvoice,
    })).toThrow("debe estar vinculada");
    expect(() => assertCreditNoteRelatedInvoicePreconditions({
      document: creditNote,
      relatedInvoice: { ...relatedInvoice, document_kind: "CREDIT_NOTE" },
    })).toThrow("debe referenciar una Factura B");
  });

  it("rejects missing or invalid issuer CUIT with fiscal settings messages", () => {
    expect(() => assertAuthorizationPreconditions({
      document: { ...document, issuer_tax_id: null },
      settings: { ...settings, issuer_tax_id: null },
      lines,
    })).toThrow("Configura el CUIT emisor en Configuracion > Facturacion fiscal.");

    expect(() => assertAuthorizationPreconditions({
      document: { ...document, issuer_tax_id: null },
      settings: { ...settings, issuer_tax_id: "20-123" },
      lines,
    })).toThrow("El CUIT emisor debe tener 11 dígitos.");
  });

  it("builds FECAESolicitar payload for Factura B consumidor final", () => {
    const payload = buildAfipSdkInvoicePayload({
      document,
      settings,
      lines,
      tokenAuthorization: { token: "token", sign: "sign" },
      voucherNumber: 42,
      voucherDate: new Date("2026-06-02T12:00:00Z"),
    });

    expect(payload).toMatchObject({
      environment: "dev",
      method: "FECAESolicitar",
      wsid: "wsfe",
      params: {
        Auth: { Cuit: "20123456789" },
        FeCAEReq: {
          FeCabReq: { CantReg: 1, PtoVta: 1, CbteTipo: AFIPSDK_INVOICE_B_TYPE },
          FeDetReq: {
            FECAEDetRequest: {
              Concepto: 1,
              DocTipo: AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE,
              DocNro: AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER,
              CbteDesde: 42,
              CbteHasta: 42,
              CbteFch: 20260602,
              ImpTotal: 121,
              ImpNeto: 100,
              ImpIVA: 21,
              MonId: "PES",
              MonCotiz: 1,
            },
          },
        },
      },
    });
  });

  it("builds IVA 0 AlicIva item for zero tax Factura B lines", () => {
    expect(buildAfipSdkVatItems([
      { vat_rate: 0, net_amount: 288, vat_amount: 0 },
      { vat_rate: 0, net_amount: 0, vat_amount: 0 },
    ])).toEqual([{ Id: AFIPSDK_IVA_0_ID, BaseImp: 288, Importe: 0 }]);

    const payload = buildAfipSdkInvoicePayload({
      document: { ...document, subtotal: 288, tax_total: 0, total: 288 },
      settings,
      lines: [
        { vat_rate: 0, net_amount: 288, vat_amount: 0 },
        { vat_rate: 0, net_amount: 0, vat_amount: 0 },
      ],
      tokenAuthorization: { token: "token", sign: "sign" },
      voucherNumber: 26436,
      voucherDate: new Date("2026-06-03T12:00:00Z"),
    });

    expect(payload.params.FeCAEReq.FeDetReq.FECAEDetRequest).toMatchObject({
      ImpTotal: 288,
      ImpNeto: 288,
      ImpIVA: 0,
      Iva: {
        AlicIva: [{ Id: AFIPSDK_IVA_0_ID, BaseImp: 288, Importe: 0 }],
      },
    });
  });

  it("builds FECAESolicitar payload for Nota de Credito B with associated Factura B", () => {
    const payload = buildAfipSdkInvoicePayload({
      document: {
        ...document,
        document_kind: "CREDIT_NOTE",
        invoice_type: "NOTA_CREDITO_B",
        related_billing_document_id: relatedInvoice.id,
      },
      settings,
      lines,
      tokenAuthorization: { token: "token", sign: "sign" },
      voucherNumber: 3,
      voucherDate: new Date("2026-06-03T12:00:00Z"),
      relatedInvoice,
    });

    expect(payload.params.FeCAEReq.FeCabReq).toMatchObject({
      CantReg: 1,
      PtoVta: 1,
      CbteTipo: AFIPSDK_CREDIT_NOTE_B_TYPE,
    });
    expect(payload.params.FeCAEReq.FeDetReq.FECAEDetRequest).toMatchObject({
      CbteDesde: 3,
      CbteHasta: 3,
      CbteFch: 20260603,
      ImpTotal: 121,
      CbtesAsoc: {
        CbteAsoc: [{
          Tipo: AFIPSDK_INVOICE_B_TYPE,
          PtoVta: 1,
          Nro: 26444,
          CbteFch: 20260603,
        }],
      },
    });
  });

  it("uses configured issuer CUIT for Afip SDK auth payload", () => {
    expect(buildAfipSdkAuthPayload({ ...settings, issuer_tax_id: "20-40937847-2" })).toEqual({
      environment: "dev",
      tax_id: "20409378472",
      wsid: "wsfe",
    });
  });

  it("uses the single enabled point of sale when the document has none", () => {
    expect(resolveAuthorizationPointOfSale({
      document: { point_of_sale: null },
      pointsOfSale: [{ point_of_sale: 3, is_enabled: true }],
    })).toBe(3);
  });

  it("keeps blocking authorization when no enabled point of sale exists", () => {
    expect(() => resolveAuthorizationPointOfSale({
      document: { point_of_sale: null },
      pointsOfSale: [],
    })).toThrow("El comprobante no tiene punto de venta fiscal configurado.");
  });

  it("blocks authorization when multiple enabled points of sale exist without selection", () => {
    expect(() => resolveAuthorizationPointOfSale({
      document: { point_of_sale: null },
      pointsOfSale: [
        { point_of_sale: 1, is_enabled: true },
        { point_of_sale: 2, is_enabled: true },
      ],
    })).toThrow("Hay más de un punto de venta habilitado. Seleccioná uno antes de autorizar.");
  });

  it("builds last voucher request and parses next source number", () => {
    const payload = buildAfipSdkLastVoucherPayload({
      settings,
      tokenAuthorization: { token: "token", sign: "sign" },
      pointOfSale: 1,
    });

    expect(payload).toMatchObject({
      method: "FECompUltimoAutorizado",
      params: { PtoVta: 1, CbteTipo: 6 },
    });
    expect(parseLastVoucherNumber({ FECompUltimoAutorizadoResult: { CbteNro: 41 } })).toBe(41);
  });

  it("builds last voucher request for Nota de Credito B type", () => {
    const payload = buildAfipSdkLastVoucherPayload({
      settings,
      tokenAuthorization: { token: "token", sign: "sign" },
      pointOfSale: 1,
      invoiceType: "NOTA_CREDITO_B",
    });

    expect(payload).toMatchObject({
      method: "FECompUltimoAutorizado",
      params: { PtoVta: 1, CbteTipo: AFIPSDK_CREDIT_NOTE_B_TYPE },
    });
  });

  it("parses CAE response and formats voucher number", () => {
    const result = parseAfipSdkAuthorizationResponse({
      response: {
        FECAESolicitarResult: {
          FeDetResp: {
            FECAEDetResponse: {
              CbteDesde: 42,
              CAE: "70400000000001",
              CAEFchVto: "20260612",
              Observaciones: { Obs: { Code: "10000", Msg: "OK" } },
            },
          },
        },
      },
      pointOfSale: 1,
      fallbackVoucherNumber: 42,
      voucherDate: new Date("2026-06-02T12:00:00Z"),
    });

    expect(result).toMatchObject({
      cae: "70400000000001",
      caeExpiresAt: "2026-06-12",
      voucherNumber: 42,
      voucherFullNumber: "00001-00000042",
      voucherDate: "2026-06-02",
    });
    expect(result.observations).toHaveLength(1);
  });

  it("redacts token, sign, access tokens, certs and keys from provider payloads", () => {
    expect(sanitizeProviderPayload({
      Authorization: "Bearer abc123",
      Auth: { Token: "token", Sign: "sign", Cuit: "20123456789" },
      access_token: "secret",
      cert: "cert",
      key: "key",
      message: "Authorization Bearer abc123",
      cae: "70400000000001",
    })).toEqual({
      Authorization: "[REDACTED]",
      Auth: { Token: "[REDACTED]", Sign: "[REDACTED]", Cuit: "20123456789" },
      access_token: "[REDACTED]",
      cert: "[REDACTED]",
      key: "[REDACTED]",
      message: "[REDACTED]",
      cae: "70400000000001",
    });
  });

  it("normalizes controlled billing error messages without leaking secrets", () => {
    expect(normalizeBillingError(Object.assign(new Error("HTTP 429 rate limit"), { status: 429 })))
      .toBe("Afip SDK recibio demasiadas solicitudes. Espera y reintenta.");
    expect(normalizeBillingError(new Error("Authorization Bearer abc123 invalid token")))
      .toBe("Las credenciales de Afip SDK no son validas o no tienen permisos.");
    expect(normalizeBillingError(new Error("fetch failed timeout")))
      .toBe("Afip SDK no respondio a tiempo. Reintenta luego.");
  });
});
