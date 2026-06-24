import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettlementsPage from "./Settlements";

const mocks = vi.hoisted(() => ({
  auth: {
    roles: ["user"],
    currentCompany: { id: "company-1", name: "Empresa Uno", slug: "empresa-uno", status: "ACTIVE" },
    companyRoleCodes: [],
    companyPermissionCodes: ["settlements.view", "settlements.edit", "settlements.submit", "settlements.receive", "settlements.cancel", "settlements.create"],
    user: { id: "user-1", email: "qa@example.com" },
  },
  fetchSettlements: vi.fn(),
  fetchSettlementDetail: vi.fn(),
  fetchSettlementLines: vi.fn(),
  createSettlementDraft: vi.fn(),
  saveSettlementDraft: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/common/CompanyAccessNotice", () => ({
  CompanyAccessNotice: ({ description }: { description: string }) => <div>{description}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/features/settlements/api", async (importActual) => ({
  ...(await importActual<typeof import("@/features/settlements/api")>()),
  fetchSettlements: mocks.fetchSettlements,
  fetchSettlementDetail: mocks.fetchSettlementDetail,
  fetchSettlementLines: mocks.fetchSettlementLines,
  createSettlementDraft: mocks.createSettlementDraft,
  saveSettlementDraft: mocks.saveSettlementDraft,
}));

function settlement(id: string, number: number, preparedByName: string) {
  return {
    id,
    company_id: "company-1",
    settlement_number: number,
    settlement_date: "2026-06-18",
    period_from: null,
    period_to: null,
    status: "DRAFT" as const,
    prepared_by_name: preparedByName,
    received_by_name: null,
    received_at: null,
    notes: null,
    created_at: "2026-06-18T10:00:00.000Z",
    updated_at: "2026-06-18T10:00:00.000Z",
    totals: {
      income_cash_total: 0,
      income_other_total: 0,
      income_total: 0,
      expense_cash_total: 0,
      expense_other_total: 0,
      expense_total: 0,
      settlement_total: 0,
    },
  };
}

function incomeLine(overrides: Partial<{
  id: string;
  line_date: string;
  work_order: string | null;
  receipt: string | null;
  quote: string | null;
  customer_name: string | null;
  concept: string;
  cash_amount: number;
  other_amount: number;
  income_type: string | null;
  display_order: number;
}> = {}) {
  return {
    id: overrides.id ?? "income-1",
    company_id: "company-1",
    settlement_id: "settlement-1",
    line_date: overrides.line_date ?? "2026-06-18",
    work_order: overrides.work_order ?? "OT-1",
    receipt: overrides.receipt ?? "R-1",
    quote: overrides.quote ?? "P-1",
    customer_name: overrides.customer_name ?? "Cliente",
    concept: overrides.concept ?? "Cobro",
    cash_amount: overrides.cash_amount ?? 100,
    other_amount: overrides.other_amount ?? 50,
    income_type: overrides.income_type ?? "Venta",
    display_order: overrides.display_order ?? 1,
  };
}

function expenseLine(overrides: Partial<{
  id: string;
  line_date: string;
  receipt: string | null;
  supplier_name: string | null;
  detail: string;
  purchase_order: string | null;
  cash_amount: number;
  other_amount: number;
  display_order: number;
}> = {}) {
  return {
    id: overrides.id ?? "expense-1",
    company_id: "company-1",
    settlement_id: "settlement-1",
    line_date: overrides.line_date ?? "2026-06-18",
    receipt: overrides.receipt ?? "F-1",
    supplier_name: overrides.supplier_name ?? "Proveedor",
    detail: overrides.detail ?? "Gasto",
    purchase_order: overrides.purchase_order ?? "OC-1",
    cash_amount: overrides.cash_amount ?? 20,
    other_amount: overrides.other_amount ?? 5,
    display_order: overrides.display_order ?? 1,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettlementsPage />
    </QueryClientProvider>,
  );
}

function amountText(amount: string) {
  return (_: string, element?: Element | null) =>
    element?.textContent?.replace(/\s|\u00a0/g, " ").trim() === `$ ${amount}`;
}

describe("SettlementsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentCompany = { id: "company-1", name: "Empresa Uno", slug: "empresa-uno", status: "ACTIVE" };
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.edit", "settlements.submit", "settlements.receive", "settlements.cancel", "settlements.create"];
    mocks.fetchSettlements.mockResolvedValue([settlement("settlement-1", 1, "Listado Uno")]);
    mocks.fetchSettlementDetail.mockResolvedValue({ ...settlement("settlement-1", 1, "Header Uno"), totals: undefined });
    mocks.fetchSettlementLines.mockResolvedValue({ incomeLines: [], expenseLines: [] });
    mocks.saveSettlementDraft.mockResolvedValue({ id: "settlement-1" });
  });

  it("shows line totals as cash plus other amounts", async () => {
    mocks.fetchSettlementLines.mockResolvedValue({
      incomeLines: [incomeLine()],
      expenseLines: [expenseLine()],
    });

    renderPage();

    expect(await screen.findByText("Cliente")).toBeInTheDocument();
    const incomeTotals = await screen.findAllByText(amountText("150,00"));
    expect(incomeTotals.length).toBeGreaterThan(0);
    expect(screen.getAllByText(amountText("25,00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 filas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Subtotal ingresos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Subtotal egresos").length).toBeGreaterThan(0);
  });

  it("shows the operational tables directly without a settlements table or summary mode", async () => {
    renderPage();

    expect(await screen.findByRole("region", { name: "Ingresos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Egresos" })).toBeInTheDocument();
    expect(screen.queryByText("Rendicion activa")).not.toBeInTheDocument();
    expect(screen.queryByText("Datos de la rendicion")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actualizar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nueva rendicion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar|Presentar|Recibir|Anular/i })).not.toBeInTheDocument();
  });

  it("presents separate income and expense tables with a clear add action for each one", async () => {
    renderPage();

    expect(await screen.findByRole("region", { name: "Ingresos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Egresos" })).toBeInTheDocument();
    const addIncome = await screen.findByRole("button", { name: /Nuevo ingreso/i });
    const addExpense = screen.getByRole("button", { name: /Nuevo egreso/i });
    expect(addIncome).toBeEnabled();
    expect(addExpense).toBeEnabled();

    fireEvent.click(addIncome);
    expect(screen.getByRole("dialog", { name: "Nuevo ingreso" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(addExpense);
    expect(screen.getByRole("dialog", { name: "Nuevo egreso" })).toBeInTheDocument();
    expect(screen.getByText("Agrega un ingreso por cada cobro o entrada de dinero.")).toBeInTheDocument();
    expect(screen.getByText("Agrega un egreso por cada pago o salida de dinero.")).toBeInTheDocument();
  });

  it("opens print date selection from the operational toolbar", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Imprimir/i }));

    expect(screen.getByRole("dialog", { name: "Imprimir rendicion" })).toBeInTheDocument();
    expect(screen.getByLabelText("Periodo a imprimir")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nota para la hoja impresa"), { target: { value: "Entregar originales" } });
    expect(screen.getByDisplayValue("Entregar originales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir impresi.n/i })).toBeInTheDocument();
  });

  it("hides edit controls without edit permission", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view"];

    renderPage();

    expect(await screen.findByRole("region", { name: "Ingresos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo ingreso/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo egreso/i })).not.toBeInTheDocument();
  });

  it("shows the requested columns and filters rows and totals by date", async () => {
    mocks.fetchSettlementLines.mockResolvedValue({
      incomeLines: [
        incomeLine({ id: "income-1", line_date: "2026-06-18", customer_name: "Cliente visible", cash_amount: 100, other_amount: 20 }),
        incomeLine({ id: "income-2", line_date: "2026-06-10", customer_name: "Cliente oculto", cash_amount: 500, other_amount: 0 }),
      ],
      expenseLines: [expenseLine({ line_date: "2026-06-18", detail: "Egreso visible", cash_amount: 30, other_amount: 0 })],
    });

    renderPage();

    expect(await screen.findByRole("columnheader", { name: "FECHA COBRO" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "OT Nº" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "TRANSF/TARJ/CHEQ" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "FC Nº" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mostrar desde"), { target: { value: "2026-06-18" } });

    expect(screen.getByText("Cliente visible")).toBeInTheDocument();
    expect(screen.queryByText("Cliente oculto")).not.toBeInTheDocument();
    expect(screen.getByText("1 ingresos y 1 egresos visibles")).toBeInTheDocument();
    expect(screen.getAllByText(amountText("120,00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(amountText("90,00")).length).toBeGreaterThan(0);
  });

  it("automatically saves a complete modal line and asks before deleting it", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Nuevo ingreso/i }));
    fireEvent.change(screen.getByLabelText("Cliente ingreso"), { target: { value: "Cliente nuevo" } });
    fireEvent.change(screen.getByLabelText("Concepto pago ingreso"), { target: { value: "Cobro nuevo" } });
    fireEvent.change(screen.getByLabelText("Efectivo ingreso"), { target: { value: "125" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    await waitFor(() => expect(mocks.saveSettlementDraft).toHaveBeenCalledWith(expect.objectContaining({
      settlementId: "settlement-1",
      incomeLines: [expect.objectContaining({ customer_name: "Cliente nuevo", concept: "Cobro nuevo", cash_amount: "125" })],
    })), { timeout: 2000 });

    fireEvent.click(screen.getByRole("button", { name: "Eliminar ingreso" }));
    expect(screen.getByRole("alertdialog", { name: "Eliminar fila" })).toBeInTheDocument();
    expect(screen.getByText("Cliente nuevo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Cliente nuevo")).toBeInTheDocument();
  });

  it("keeps the tables visible while an added line is being saved", async () => {
    let finishSave: (() => void) | undefined;
    mocks.saveSettlementDraft.mockImplementation(() => new Promise<void>((resolve) => {
      finishSave = resolve;
    }));

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Nuevo ingreso/i }));
    fireEvent.change(screen.getByLabelText("Cliente ingreso"), { target: { value: "Cliente sin parpadeo" } });
    fireEvent.change(screen.getByLabelText("Concepto pago ingreso"), { target: { value: "Cobro pendiente" } });
    fireEvent.change(screen.getByLabelText("Efectivo ingreso"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    await waitFor(() => expect(mocks.saveSettlementDraft).toHaveBeenCalled());

    expect(screen.getByRole("region", { name: "Ingresos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Egresos" })).toBeInTheDocument();
    expect(screen.getByText("Cliente sin parpadeo")).toBeInTheDocument();
    expect(screen.getByText("Guardando cambios...")).toBeInTheDocument();
    expect(screen.queryByText("Preparando ingresos y egresos...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo ingreso/i })).toBeDisabled();

    finishSave?.();
    await waitFor(() => expect(screen.queryByText("Guardando cambios...")).not.toBeInTheDocument());
  });
});
