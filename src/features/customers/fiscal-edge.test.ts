import { describe, expect, it } from "vitest";
import {
  buildAfipSdkAuthPayload,
  buildAfipSdkPadronPayload,
  extractFiscalLookupData,
  getCuitValidationMessage,
  sanitizeProviderPayload,
} from "../../../supabase/functions/customer-fiscal-lookup/logic";

describe("customer fiscal lookup edge logic", () => {
  it("rejects invalid CUIT before provider calls", () => {
    expect(getCuitValidationMessage("20-40937847-3")).toContain("digito verificador");
    expect(getCuitValidationMessage("letras")).toContain("solo puede contener");
  });

  it("builds AFIPSDK dev padron requests without prod environment", () => {
    expect(buildAfipSdkAuthPayload("20409378472")).toMatchObject({
      environment: "dev",
      wsid: "ws_sr_constancia_inscripcion",
    });
    expect(buildAfipSdkPadronPayload({
      token: "token",
      sign: "sign",
      issuerTaxId: "20409378472",
      taxId: "20409378472",
    })).toMatchObject({
      environment: "dev",
      method: "getPersona_v2",
      wsid: "ws_sr_constancia_inscripcion",
    });
  });

  it("extracts fiscal data and stores a sanitized snapshot on success", () => {
    const response = {
      getPersona_v2Return: {
        datosGenerales: {
          razonSocial: "CLIENTE SA",
          domicilioFiscal: {
            direccion: "Calle 123",
          },
        },
        datosRegimenGeneral: {
          impuesto: [{ descripcionImpuesto: "IVA" }],
        },
        token: "secret",
      },
    };

    expect(extractFiscalLookupData("20409378472", response)).toMatchObject({
      legalName: "CLIENTE SA",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      fiscalAddress: "Calle 123",
      status: "VALIDATED",
      snapshot: {
        getPersona_v2Return: {
          token: "[REDACTED]",
        },
      },
    });
  });

  it("redacts secrets from provider snapshots", () => {
    expect(sanitizeProviderPayload({
      Authorization: "Bearer abc123",
      Auth: { Token: "token", Sign: "sign" },
      privateKey: "secret",
    })).toEqual({
      Authorization: "[REDACTED]",
      Auth: { Token: "[REDACTED]", Sign: "[REDACTED]" },
      privateKey: "[REDACTED]",
    });
  });
});
