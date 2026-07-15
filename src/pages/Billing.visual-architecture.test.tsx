import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingDocumentRow } from "@/features/billing/types";
import BillingPage from "./Billing";

const billingDocument: BillingDocumentRow = {
  id: "billing-1",
  company_id: "company-1",
  source_type: "CASH_SALE_FROM_REMITO",
  source_id: "sale-1",
  source_remito_id: "remito-1",
  related_billing_document_id: null,
  document_kind: "INVOICE",
  invoice_type: "FACTURA_B",
  fiscal_status: "AUTHORIZED",
  provider: "AFIPSDK",
  environment: "dev",
  issuer_tax_id: "30712345678",
  issuer_name: "Stock Sur",
  issuer_tax_condition: "RESPONSABLE_INSCRIPTO",
  receiver_name: "Cliente Norte",
  receiver_doc_type: "DNI",
  receiver_doc_number: "30111222",
  receiver_tax_condition: "CONSUMIDOR_FINAL",
  receiver_fiscal_snapshot: null,
  currency: "ARS",
  currency_rate: 1,
  subtotal: 1_000,
  discount_total: 0,
  tax_total: 210,
  total: 1_210,
  point_of_sale: 1,
  voucher_number: 12,
  voucher_full_number: "0001-00000012",
  voucher_date: "2026-07-15",
  cae: "12345678901234",
  cae_expires_at: "2026-07-25",
  authorized_at: "2026-07-15T10:05:00Z",
  authorized_by: "user-1",
  provider_errors: null,
  provider_observations: null,
  error_message: null,
  created_at: "2026-07-15T10:00:00Z",
  updated_at: "2026-07-15T10:05:00Z",
};

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    roles: ["admin"],
    currentCompany: { id: "company-1", name: "Empresa Uno" },
    companyRoleCodes: ["admin"],
    companyPermissionCodes: ["billing.view"],
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/permissions", () => ({
  canManageBillingSettings: () => true,
  canViewBilling: () => true,
}));

vi.mock("@/features/billing/hooks/useBillingData", () => ({
  useBillingSettings: () => ({ billingEnabled: true }),
  useBillingDocuments: () => ({
    data: [billingDocument],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useBillingRemitoReferences: () => ({
    data: new Map([["remito-1", { id: "remito-1", point_of_sale: 1, document_number: 9, customer_name: "Cliente Norte" }]]),
  }),
  useBillingDocumentLines: () => ({
    data: [{
      id: "line-1",
      billing_document_id: "billing-1",
      source_document_line_id: "source-line-1",
      line_order: 1,
      description: "Producto de prueba",
      unit: "UN",
      quantity: 1,
      unit_price: 1_000,
      discount_pct: 0,
      discount_total: 0,
      vat_rate: 21,
      net_amount: 1_000,
      vat_amount: 210,
      total: 1_210,
    }],
    isLoading: false,
  }),
}));

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
  useBillingActions: () => ({
    createBillingCreditNoteMutation: { isPending: false, mutate: vi.fn() },
    authorizeBillingDocumentMutation: { isPending: false, mutate: vi.fn() },
    resetStaleAuthorizationMutation: { isPending: false, mutate: vi.fn() },
  }),
}));

vi.mock("@/features/billing/lib/authorization", () => ({
  canShowResetStaleAuthorizationAction: () => false,
  canShowAuthorizeBillingDocumentAction: () => false,
  canShowCreateCreditNoteBAction: () => false,
  canShowPrintBillingDocumentAction: () => false,
  getBillingDocumentOriginLabel: () => "Venta desde remito",
  getBillingDocumentTypeLabel: () => "Factura B",
  hasActiveTotalCreditNoteForInvoice: () => false,
  isRecentAuthorizingDocument: () => false,
}));

describe("BillingPage visual architecture", () => {
  it("presents fiscal context, operational metrics and responsive document selectors", () => {
    render(<BillingPage />);

    expect(screen.getByRole("heading", { name: "Facturación" })).toBeInTheDocument();
    expect(screen.getByText("Homologación / dev")).toBeInTheDocument();
    expect(screen.getByText("Producción no habilitada")).toBeInTheDocument();
    expect(screen.getByText("Autorizados")).toBeInTheDocument();
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    expect(screen.getByText("Rechazados")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comprobantes fiscales" })).toBeInTheDocument();
    expect(screen.getByText("1 registro")).toBeInTheDocument();

    const mobileSelector = screen.getByRole("button", { name: /Factura B.*Cliente Norte.*Autorizado/s });
    expect(mobileSelector).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("columnheader", { name: "CAE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seleccionado" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains an empty filter result and restores the complete list", () => {
    render(<BillingPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar comprobantes" }), {
      target: { value: "cliente inexistente" },
    });

    expect(screen.getByText("No hay comprobantes que coincidan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.getAllByText("Cliente Norte").length).toBeGreaterThan(0);
  });
});
