import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomerFormDialog, type CustomerFormState } from "./components/CustomerFormDialog";
import type { Customer } from "./types";

const baseForm: CustomerFormState = {
  name: "Cliente SA",
  cuit: "",
  email: "",
  phone: "",
  is_occasional: false,
  fiscal_tax_id: "20-40937847-2",
  fiscal_legal_name: "Cliente SA",
  fiscal_tax_condition: "RESPONSABLE_INSCRIPTO",
  fiscal_address: "Calle 123",
  fiscal_validation_status: "VALIDATED_AUTO",
  fiscal_validated_at: "2026-06-04T12:00:00Z",
  fiscal_lookup_diagnostics: null,
};

const customer: Customer = {
  id: "customer-1",
  company_id: "company-1",
  name: "Cliente SA",
  cuit: null,
  email: null,
  phone: null,
  is_occasional: false,
  fiscal_profile: {
    id: "profile-1",
    company_id: "company-1",
    customer_id: "customer-1",
    tax_id: "20409378472",
    legal_name: "Cliente SA",
    tax_condition: "RESPONSABLE_INSCRIPTO",
    fiscal_address: "Calle 123",
    taxpayer_status: "ACTIVO",
    validation_status: "VALIDATED_AUTO",
    validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
    tax_condition_source: "OFFICIAL_DERIVED",
    legal_name_source: "OFFICIAL",
    validation_error: null,
    validation_snapshot: {},
    validated_at: "2026-06-04T12:00:00Z",
    created_by: null,
    updated_by: null,
    created_at: "2026-06-04T12:00:00Z",
    updated_at: "2026-06-04T12:00:00Z",
  },
};

function renderDialog(form: CustomerFormState, editingCustomer: Customer | null = customer) {
  return render(
    <CustomerFormDialog
      open
      editingCustomer={editingCustomer}
      form={form}
      isSaving={false}
      isValidatingFiscal={false}
      onOpenChange={vi.fn()}
      onFormChange={vi.fn()}
      onSubmit={vi.fn()}
      onValidateFiscal={vi.fn()}
    />,
  );
}

describe("customer fiscal UI", () => {
  it("shows fiscal data section and ready state only for complete validated profile", () => {
    renderDialog(baseForm);
    expect(screen.getByText("Datos fiscales para Factura A futura")).toBeInTheDocument();
    expect(screen.getByText("Listo para Factura A")).toBeInTheDocument();
  });

  it("does not expose occasional customer editing as a customer form option", () => {
    renderDialog({ ...baseForm, is_occasional: true }, { ...customer, is_occasional: true });
    expect(screen.queryByRole("checkbox", { name: /cliente ocasional/i })).not.toBeInTheDocument();
    expect(screen.getByText("Cliente ocasional no aplica: los clientes creados aqui son registrados.")).toBeInTheDocument();
  });

  it("shows lookup environment and clear diagnostic reason when fiscal lookup fails", () => {
    renderDialog({
      ...baseForm,
      fiscal_legal_name: "",
      fiscal_tax_condition: "UNKNOWN",
      fiscal_address: "",
      fiscal_validation_status: "ERROR",
      fiscal_validated_at: null,
      fiscal_lookup_diagnostics: {
        ok: false,
        code: "TAX_CONDITION_UNKNOWN",
        message: "ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.",
        lookupEnvironment: "dev",
        billingEnvironment: "dev",
        wsid: "ws_sr_constancia_inscripcion",
        method: "getPersona_v2",
        issuerTaxIdMasked: "20******472",
        warning: null,
        taxpayerFound: true,
        hasDatosGenerales: true,
        hasRegimenGeneral: true,
        hasImpuestos: false,
        hasMonotributo: false,
        taxpayerStatus: "ACTIVO",
        legalNameFound: false,
        taxCondition: "UNKNOWN",
        eligibleForInvoiceA: false,
        reason: "ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.",
        normalizationReason: "ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.",
        availableTaxIds: [],
        availableTaxDescriptions: [],
      },
    });

    expect(screen.getByText("Ambiente de consulta: dev")).toBeInTheDocument();
    expect(screen.getByText("Emision fiscal: dev")).toBeInTheDocument();
    expect(screen.getByText("CUIT emisor: 20******472")).toBeInTheDocument();
    expect(screen.getByText("Consulta en ambiente dev. Los CUIT reales pueden no devolver datos completos.")).toBeInTheDocument();
    expect(screen.getByText("Factura A futura. No emite comprobantes desde esta validacion.")).toBeInTheDocument();
    expect(screen.getByText("ARCA devolvio datos, pero no impuestos suficientes para determinar IVA.")).toBeInTheDocument();
    expect(screen.getByText(/Estado tecnico QA:/)).toHaveTextContent("taxpayerFound=true");
  });
});
