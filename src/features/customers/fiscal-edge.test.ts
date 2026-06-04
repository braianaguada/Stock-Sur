import { describe, expect, it } from "vitest";
import {
  buildAfipSdkAuthPayload,
  buildAfipSdkPadronPayload,
  extractFiscalLookupData,
  getCuitValidationMessage,
  normalizeTaxConditionFromConstancia,
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
    expect(buildAfipSdkAuthPayload("20409378472", "prod")).toMatchObject({
      environment: "prod",
    });
    expect(buildAfipSdkPadronPayload({
      token: "token",
      sign: "sign",
      issuerTaxId: "20409378472",
      taxId: "20409378472",
      environment: "prod",
    })).toMatchObject({
      environment: "prod",
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
      status: "VALIDATED_AUTO",
      taxConditionSource: "OFFICIAL_DERIVED",
      legalNameSource: "OFFICIAL",
      eligibleForInvoiceA: true,
      snapshot: {
        getPersona_v2Return: {
          token: "[REDACTED]",
        },
      },
    });
  });

  it("extracts legal names from persona humana responses", () => {
    const response = {
      getPersona_v2Return: {
        datosGenerales: {
          apellido: "PEREZ",
          nombre: "JUAN",
          domicilioFiscal: {
            calle: "San Martin",
            numero: "100",
            localidad: "Rosario",
            descripcionProvincia: "Santa Fe",
          },
        },
        datosRegimenGeneral: {
          impuesto: [{ descripcionImpuesto: "IVA" }],
        },
      },
    };

    expect(extractFiscalLookupData("20409378472", response)).toMatchObject({
      legalName: "PEREZ JUAN",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      fiscalAddress: "San Martin 100 Rosario Santa Fe",
    });
  });

  it("extracts legal names from denominacion fields", () => {
    const response = {
      payload: {
        persona: {
          denominacion: "CLIENTE SRL",
        },
        datosRegimenGeneral: {
          impuesto: [{ descripcion: "IVA" }],
        },
      },
    };

    expect(extractFiscalLookupData("30711582890", response)).toMatchObject({
      legalName: "CLIENTE SRL",
      taxCondition: "RESPONSABLE_INSCRIPTO",
    });
  });

  it("does not require legal name when IVA condition is inferable", () => {
    const response = {
      personaReturn: {
        datosRegimenGeneral: {
          impuesto: [{ descripcionImpuesto: "IVA" }],
        },
      },
    };

    expect(extractFiscalLookupData("30711582890", response)).toMatchObject({
      legalName: null,
      taxCondition: "RESPONSABLE_INSCRIPTO",
      legalNameSource: "UNKNOWN",
    });
  });

  it("normalizes IVA condition from official constancia fields", () => {
    expect(normalizeTaxConditionFromConstancia({
      personaReturn: {
        datosGenerales: { estadoClave: "ACTIVO" },
        datosRegimenGeneral: { impuesto: [{ idImpuesto: 30, estadoImpuesto: "ACTIVO" }] },
      },
    })).toMatchObject({
      taxCondition: "RESPONSABLE_INSCRIPTO",
      taxConditionSource: "OFFICIAL_DERIVED",
      eligibleForInvoiceA: true,
      taxpayerStatus: "ACTIVO",
    });

    expect(normalizeTaxConditionFromConstancia({
      personaReturn: {
        datosGenerales: { estadoClave: "ACTIVO" },
        datosMonotributo: { categoriaMonotributo: "A" },
      },
    })).toMatchObject({
      taxCondition: "MONOTRIBUTO",
      taxConditionSource: "OFFICIAL_DERIVED",
      eligibleForInvoiceA: false,
    });

    expect(normalizeTaxConditionFromConstancia({
      personaReturn: {
        datosGenerales: { estadoClave: "INACTIVO" },
        datosRegimenGeneral: { impuesto: [{ descripcionImpuesto: "IVA" }] },
      },
    })).toMatchObject({
      taxCondition: "UNKNOWN",
      taxConditionSource: "UNKNOWN",
      eligibleForInvoiceA: false,
      reason: "CUIT no activo",
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
