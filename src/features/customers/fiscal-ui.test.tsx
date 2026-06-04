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
  fiscal_validation_status: "VALIDATED",
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
    validation_status: "VALIDATED",
    validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
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
    expect(screen.getByText("Datos fiscales")).toBeInTheDocument();
    expect(screen.getByText("Listo para Factura A")).toBeInTheDocument();
  });

  it("shows occasional customer warning", () => {
    renderDialog({ ...baseForm, is_occasional: true }, { ...customer, is_occasional: true });
    expect(screen.getByText("Cliente ocasional no es valido para Factura A.")).toBeInTheDocument();
    expect(screen.getByText("No listo para Factura A")).toBeInTheDocument();
  });
});
