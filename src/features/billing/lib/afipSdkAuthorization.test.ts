import { describe, expect, it } from "vitest";
import {
  AFIPSDK_CONSUMIDOR_FINAL_DOC_NUMBER,
  AFIPSDK_CONSUMIDOR_FINAL_DOC_TYPE,
  AFIPSDK_INVOICE_B_TYPE,
  assertAuthorizationPreconditions,
  buildAfipSdkInvoicePayload,
  buildAfipSdkLastVoucherPayload,
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
};

const lines = [{
  vat_rate: 21,
  net_amount: 100,
  vat_amount: 21,
}];

describe("Afip SDK authorization logic", () => {
  it("validates only Factura B AFIPSDK dev documents", () => {
    expect(() => assertAuthorizationPreconditions({ document, settings, lines })).not.toThrow();
    expect(() => assertAuthorizationPreconditions({
      document: { ...document, invoice_type: "FACTURA_A" },
      settings,
      lines,
    })).toThrow("Solo se admite Factura B");
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
      Authorization: "[REDACTED]",
      Auth: { Token: "token", Sign: "sign", Cuit: "20123456789" },
      access_token: "secret",
      cert: "cert",
      key: "key",
    })).toEqual({
      Authorization: "[REDACTED]",
      Auth: { Token: "[REDACTED]", Sign: "[REDACTED]", Cuit: "20123456789" },
      access_token: "[REDACTED]",
      cert: "[REDACTED]",
      key: "[REDACTED]",
    });
  });
});
