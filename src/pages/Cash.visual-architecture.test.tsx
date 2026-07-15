import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import CashPage from "./Cash";
import type { CashSummary } from "@/features/cash/types";

const mutation = { isPending: false, mutate: vi.fn() };

const summary: CashSummary = {
  efectivoRemito: 1000,
  efectivoFacturable: 500,
  serviciosRemito: 0,
  point: 200,
  transferencia: 100,
  cuentaCorriente: 300,
  total: 2100,
  pendientes: 0,
  gastosTotal: 0,
  gastosEfectivo: 0,
  gastosNoEfectivo: 50,
  efectivoAntesGastos: 1500,
  efectivoNetoEsperado: 1500,
};

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    roles: ["admin"],
    currentCompany: { id: "company-1" },
  }),
}));

vi.mock("@/contexts/company-brand-context", () => ({
  useCompanyBrand: () => ({
    settings: {
      app_name: "Stock Sur",
      auto_close_cash_enabled: false,
      auto_close_cash_time: null,
      document_footer: "",
      logo_url: null,
      document_tagline: "",
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/features/cash/hooks/useCashMutations", () => ({
  useCashMutations: () => ({
    createSaleMutation: mutation,
    createExpenseMutation: mutation,
    attachReceiptMutation: mutation,
    cancelSaleMutation: mutation,
    cancelExpenseMutation: mutation,
    closeClosureMutation: mutation,
  }),
}));

vi.mock("@/features/cash/hooks/useCashData", () => ({
  useCashData: () => ({
    customers: [],
    remitos: [],
    closure: null,
    closureLoading: false,
    closureError: null,
    salesLoading: false,
    expenses: [],
    expensesLoading: false,
    salesError: null,
    expensesError: null,
    remitosError: null,
    linkedDocument: null,
    linkedDocumentLines: [],
    linkedDocumentEvents: [],
    closuresHistory: [
      {
        id: "history-1",
        business_date: "2026-05-14",
        status: "CERRADO",
        expected_cash_remito_total: 1000,
        expected_cash_facturable_total: 500,
        expected_services_remito_total: 0,
        expected_cash_sales_total: 1500,
        expected_point_sales_total: 200,
        expected_transfer_sales_total: 100,
        expected_account_sales_total: 300,
        expected_account_expenses_total: 50,
        expected_cash_expenses_total: 25,
        expected_sales_total: 2100,
        expected_cash_to_render: 1475,
        counted_cash_total: null,
        counted_point_total: null,
        counted_transfer_total: null,
        cash_difference: null,
        point_difference: null,
        transfer_difference: null,
        notes: null,
        closed_at: "2026-05-14T22:00:00.000Z",
      },
    ],
    selectedClosureSales: [],
    selectedClosureSalesForPreview: [],
    selectedClosureMovementsForPreview: [],
    summary,
    pendingSales: [],
    effectiveClosure: {
      id: "closure-1",
      business_date: "2026-05-15",
      status: "ABIERTO",
      expected_cash_remito_total: 1000,
      expected_cash_facturable_total: 500,
      expected_services_remito_total: 0,
      expected_cash_sales_total: 1500,
      expected_point_sales_total: 200,
      expected_transfer_sales_total: 100,
      expected_account_sales_total: 300,
      expected_cash_expenses_total: 0,
      expected_account_expenses_total: 0,
      expected_sales_total: 2100,
      expected_cash_to_render: 1500,
      expected_non_cash_total: 600,
      counted_cash_total: null,
      counted_point_total: null,
      counted_transfer_total: null,
      cash_difference: null,
      point_difference: null,
      transfer_difference: null,
      notes: null,
      closed_at: null,
    },
    hasClosedClosureForDay: false,
    availableRemitos: [],
    availableFacturableRemitos: [],
    availableReturnRemitos: [],
    unclosedSalesAfterClosure: [],
    filteredSales: [],
    selectedClosurePreview: null,
    usedReceiptReferences: new Set(),
    refreshCash: vi.fn(),
  }),
}));

vi.mock("@/features/billing/hooks/useBillingData", () => ({
  useActiveBillingSourceIds: () => ({ billedSourceIds: new Set<string>() }),
  useBillingSettings: () => ({ billingEnabled: false, settings: null, isLoading: false }),
}));

vi.mock("@/features/billing/hooks/useBillingActions", () => ({
  useBillingActions: () => ({ createBillingDraftMutation: mutation }),
}));

describe("CashPage visual architecture", () => {
  it("renders a compact header with actions and operative date together", () => {
    render(<CashPage />);

    expect(screen.getByRole("heading", { name: "Caja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nueva venta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver historial/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha operativa/i)).toBeInTheDocument();
  });

  it("keeps Pendientes and Historial out of the primary tabs", () => {
    render(<CashPage />);

    expect(screen.getByRole("tab", { name: "Movimientos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gastos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cierre" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Pendientes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Historial" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver historial/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revisar pendientes/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tablist")).toHaveLength(1);
  });

  it("does not show the new sale form inside Gastos", async () => {
    const user = userEvent.setup();
    render(<CashPage />);

    expect(screen.getByRole("button", { name: "Registrar venta" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Gastos" }));

    expect(screen.getByRole("button", { name: "Registrar gasto" })).toBeInTheDocument();
    expect(screen.getByText("Gastos fuera de caja")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar venta" })).not.toBeInTheDocument();
  });

  it("opens the improved history view as a secondary surface", async () => {
    const user = userEvent.setup();
    render(<CashPage />);

    await user.click(screen.getByRole("button", { name: /ver historial/i }));

    expect(screen.getByText("Historial de cierres")).toBeInTheDocument();
    expect(screen.getByText("Total ventas")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getAllByText("Gastos").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /ver resumen/i })).toBeInTheDocument();
  });
});
