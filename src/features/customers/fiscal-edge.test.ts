import { describe, expect, it } from "vitest";
import {
  buildAfipSdkAuthPayload,
  buildAfipSdkPadronPayload,
  buildFiscalLookupDiagnostics,
  buildLookupEnvironmentWarning,
  extractFiscalLookupData,
  getCuitValidationMessage,
  maskTaxId,
  normalizeFiscalLookupWsid,
  normalizeTaxConditionFromConstancia,
  resolveFiscalLookupEnvironment,
  resolveLookupIssuerTaxId,
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

  it("uses customer fiscal lookup environment before AFIPSDK environment", () => {
    expect(resolveFiscalLookupEnvironment({
      customerFiscalLookupEnvironment: "prod",
      afipSdkEnvironment: "dev",
    })).toBe("prod");
    expect(resolveFiscalLookupEnvironment({
      customerFiscalLookupEnvironment: null,
      afipSdkEnvironment: "prod",
    })).toBe("prod");
    expect(resolveFiscalLookupEnvironment({
      customerFiscalLookupEnvironment: null,
      afipSdkEnvironment: null,
    })).toBe("dev");
  });

  it("uses customer fiscal lookup issuer tax id before billing settings fallback", () => {
    expect(resolveLookupIssuerTaxId({
      customerFiscalLookupIssuerTaxId: "30-71158289-0",
      billingIssuerTaxId: "20-40937847-2",
    })).toEqual({
      issuerTaxId: "30711582890",
      source: "CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID",
    });
    expect(resolveLookupIssuerTaxId({
      customerFiscalLookupIssuerTaxId: "",
      billingIssuerTaxId: "20-40937847-2",
    })).toEqual({
      issuerTaxId: "20409378472",
      source: "billing_settings.issuer_tax_id",
    });
    expect(resolveLookupIssuerTaxId({
      customerFiscalLookupIssuerTaxId: "",
      billingIssuerTaxId: "",
    })).toEqual({
      issuerTaxId: "",
      source: null,
    });
  });

  it("allows lookup prod with billing dev and emits an explicit warning", () => {
    expect(buildLookupEnvironmentWarning("prod", "dev")).toBe(
      "Consulta de padron en produccion. La emision de comprobantes sigue en homologacion/dev.",
    );
    expect(buildLookupEnvironmentWarning("dev", "dev")).toBeNull();
  });

  it("keeps fiscal lookup wsid constrained to constancia", () => {
    expect(normalizeFiscalLookupWsid("ws_sr_constancia_inscripcion")).toBe("ws_sr_constancia_inscripcion");
    expect(normalizeFiscalLookupWsid("wsfe")).toBe("ws_sr_constancia_inscripcion");
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
      legalName: "",
      taxCondition: "RESPONSABLE_INSCRIPTO",
      legalNameSource: "UNKNOWN",
    });
  });

  it("extracts legal name from datosGenerales.razonSocial and never falls back to CUIT text", () => {
    const validResponse = {
      result: {
        personaReturn: {
          datosGenerales: { razonSocial: "ALPATACO SA" },
          datosRegimenGeneral: { impuesto: { idImpuesto: 30 } },
        },
      },
    };
    const cuitAsNameResponse = {
      data: {
        personaReturn: {
          datosGenerales: { razonSocial: "204209512345" },
          datosRegimenGeneral: { impuesto: { idImpuesto: 30 } },
        },
      },
    };

    expect(extractFiscalLookupData("30711582890", validResponse)).toMatchObject({
      legalName: "ALPATACO SA",
      legalNameSource: "OFFICIAL",
    });
    expect(extractFiscalLookupData("30711582890", cuitAsNameResponse)).toMatchObject({
      legalName: "",
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

  it("supports idImpuesto as string, descripcion IVA, object and array impuesto shapes", () => {
    expect(normalizeTaxConditionFromConstancia({
      data: {
        personaReturn: {
          datosGenerales: { estadoClave: "ACTIVO" },
          datosRegimenGeneral: { impuesto: { idImpuesto: "30", estadoImpuesto: "ACTIVO" } },
        },
      },
    })).toMatchObject({ taxCondition: "RESPONSABLE_INSCRIPTO", eligibleForInvoiceA: true });

    expect(normalizeTaxConditionFromConstancia({
      result: {
        datosGenerales: { estadoClave: "ACTIVO" },
        datosRegimenGeneral: { impuestos: [{ descripcionImpuesto: "IVA responsable inscripto" }] },
      },
    })).toMatchObject({ taxCondition: "RESPONSABLE_INSCRIPTO", eligibleForInvoiceA: true });
  });

  it("returns diagnostic codes for missing taxpayer, inactive CUIT and unknown tax condition", () => {
    expect(normalizeTaxConditionFromConstancia(null)).toMatchObject({
      code: "TAXPAYER_NOT_FOUND",
      taxCondition: "UNKNOWN",
      taxpayerFound: false,
    });

    expect(normalizeTaxConditionFromConstancia({
      personaReturn: {
        datosGenerales: { estadoClave: "BAJA" },
        datosRegimenGeneral: { impuesto: [{ idImpuesto: 30 }] },
      },
    })).toMatchObject({
      code: "TAXPAYER_INACTIVE",
      taxCondition: "UNKNOWN",
      taxpayerStatus: "BAJA",
    });

    expect(normalizeTaxConditionFromConstancia({
      personaReturn: {
        datosGenerales: { estadoClave: "ACTIVO" },
        datosRegimenGeneral: { impuesto: [{ idImpuesto: 99, descripcionImpuesto: "GANANCIAS" }] },
      },
    })).toMatchObject({
      code: "TAX_CONDITION_UNKNOWN",
      hasImpuestos: true,
      availableTaxIds: [99],
      availableTaxDescriptions: ["GANANCIAS"],
    });
  });

  it("builds sanitized compact diagnostics without secrets", () => {
    const diagnostics = buildFiscalLookupDiagnostics({
      response: {
        personaReturn: {
          datosGenerales: { razonSocial: "CLIENTE SA", estadoClave: "ACTIVO" },
          datosRegimenGeneral: {
            impuesto: [
              { idImpuesto: 99, descripcionImpuesto: "GANANCIAS <script>alert(1)</script>" },
            ],
          },
          token: "secret-token",
          sign: "secret-sign",
        },
      },
      lookupEnvironment: "dev",
      billingEnvironment: "dev",
      issuerTaxId: "30-71158289-0",
      code: "TAX_CONDITION_UNKNOWN",
      message: "No se pudo determinar IVA.",
    });

    expect(JSON.stringify(diagnostics)).not.toMatch(/token|sign|Bearer|cert|key|secret-token|secret-sign/i);
    expect(diagnostics).toMatchObject({
      code: "TAX_CONDITION_UNKNOWN",
      lookupEnvironment: "dev",
      billingEnvironment: "dev",
      wsid: "ws_sr_constancia_inscripcion",
      method: "getPersona_v2",
      issuerTaxIdMasked: "30******890",
      taxpayerFound: true,
      hasDatosGenerales: true,
      hasRegimenGeneral: true,
      hasImpuestos: true,
      legalNameFound: true,
      taxCondition: "UNKNOWN",
      eligibleForInvoiceA: false,
    });
    expect(diagnostics.availableTaxDescriptions[0]).not.toContain("<script>");
  });

  it("masks issuer tax id in diagnostics and never exposes the raw CUIT", () => {
    const diagnostics = buildFiscalLookupDiagnostics({
      response: {
        personaReturn: {
          datosGenerales: { razonSocial: "CLIENTE SA", estadoClave: "ACTIVO" },
          datosRegimenGeneral: { impuesto: [{ idImpuesto: 30 }] },
        },
      },
      lookupEnvironment: "prod",
      billingEnvironment: "dev",
      issuerTaxId: "30711582890",
      warning: buildLookupEnvironmentWarning("prod", "dev"),
    });

    expect(maskTaxId("30711582890")).toBe("30******890");
    expect(JSON.stringify(diagnostics)).not.toContain("30711582890");
    expect(diagnostics).toMatchObject({
      code: "VALIDATED_AUTO",
      lookupEnvironment: "prod",
      billingEnvironment: "dev",
      issuerTaxIdMasked: "30******890",
      warning: "Consulta de padron en produccion. La emision de comprobantes sigue en homologacion/dev.",
      eligibleForInvoiceA: true,
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
