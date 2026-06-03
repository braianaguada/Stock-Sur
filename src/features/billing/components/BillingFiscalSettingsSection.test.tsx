import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BillingFiscalSettingsSection } from "./BillingFiscalSettingsSection";
import type { BillingPointOfSaleRow, BillingSettingsRow } from "../types";

const settings: BillingSettingsRow[] = [{
  id: "settings-1",
  company_id: "company-1",
  provider: "AFIPSDK",
  environment: "dev",
  is_enabled: true,
  default_currency: "ARS",
  default_concept: "PRODUCTS",
  credentials_status: "NOT_CONFIGURED",
  issuer_tax_id: null,
  issuer_name: null,
  issuer_tax_condition: null,
  notes: null,
}];

const pointsOfSale: BillingPointOfSaleRow[] = [{
  id: "pos-1",
  company_id: "company-1",
  billing_settings_id: "settings-1",
  point_of_sale: 1,
  description: "QA",
  is_enabled: true,
  created_at: "2026-06-02T00:00:00Z",
  updated_at: "2026-06-02T00:00:00Z",
}];

function renderSection(options?: { canEdit?: boolean; onSaveSettings?: ReturnType<typeof vi.fn> }) {
  return render(
    <BillingFiscalSettingsSection
      settings={settings}
      pointsOfSale={pointsOfSale}
      isLoading={false}
      onSaveSettings={options?.onSaveSettings ?? vi.fn()}
      onCreatePointOfSale={vi.fn()}
      onUpdatePointOfSale={vi.fn()}
      savingSettings={false}
      creatingPointOfSale={false}
      updatingPointOfSale={false}
      toast={vi.fn()}
      canEdit={options?.canEdit ?? true}
      diagnostics={{
        billingEnabled: true,
        provider: "AFIPSDK",
        environment: "dev",
        issuerTaxIdConfigured: true,
        issuerTaxIdValid: true,
        posConfigured: true,
        afipSdkAccessTokenConfigured: true,
        afipSdkBaseUrlConfigured: true,
        afipSdkEnvironmentConfigured: true,
        edgeFunctionAvailable: true,
        lastAuthorizedAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
      }}
    />,
  );
}

describe("BillingFiscalSettingsSection", () => {
  it("saves issuer CUIT normalized without separators", () => {
    const onSaveSettings = vi.fn();
    renderSection({ onSaveSettings });

    fireEvent.change(screen.getByLabelText("CUIT emisor"), { target: { value: "20-40937847-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuracion" }));

    expect(onSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ issuerTaxId: "20409378472" }),
      expect.any(Object),
    );
  });

  it("rejects invalid issuer CUIT before saving", () => {
    const onSaveSettings = vi.fn();
    renderSection({ onSaveSettings });

    fireEvent.change(screen.getByLabelText("CUIT emisor"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuracion" }));

    expect(screen.getByText("El CUIT emisor debe tener 11 dígitos.")).toBeInTheDocument();
    expect(onSaveSettings).not.toHaveBeenCalled();
  });

  it("shows fiscal status but disables CUIT editing without billing.settings", () => {
    renderSection({ canEdit: false });

    expect(screen.getByText("Estado credenciales")).toBeInTheDocument();
    expect(screen.getByLabelText("CUIT emisor")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar configuracion" })).not.toBeInTheDocument();
  });

  it("shows diagnostics checks without secret values", () => {
    renderSection();

    expect(screen.getByText("Estado de configuracion")).toBeInTheDocument();
    expect(screen.getByText("Secret AFIPSDK token")).toBeInTheDocument();
    expect(screen.getByText("Secret base URL")).toBeInTheDocument();
    expect(screen.queryByText(/Bearer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/access_token/i)).not.toBeInTheDocument();
  });
});
