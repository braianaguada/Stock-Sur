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
  submitSettlement: vi.fn(),
  receiveSettlement: vi.fn(),
  cancelSettlement: vi.fn(),
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
  submitSettlement: mocks.submitSettlement,
  receiveSettlement: mocks.receiveSettlement,
  cancelSettlement: mocks.cancelSettlement,
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
    mocks.submitSettlement.mockResolvedValue({ id: "settlement-1", status: "SUBMITTED" });
    mocks.receiveSettlement.mockResolvedValue({ id: "settlement-1", status: "RECEIVED" });
    mocks.cancelSettlement.mockResolvedValue({ id: "settlement-1", status: "CANCELLED" });
  });

  it("clears the editor and blocks it while switching settlements", async () => {
    mocks.fetchSettlements.mockResolvedValue([
      settlement("settlement-1", 1, "Listado Uno"),
      settlement("settlement-2", 2, "Listado Dos"),
    ]);
    mocks.fetchSettlementDetail.mockImplementation((_: string, settlementId: string) => {
      if (settlementId === "settlement-1") return Promise.resolve({ ...settlement("settlement-1", 1, "Header Uno"), totals: undefined });
      return new Promise(() => {});
    });
    mocks.fetchSettlementLines.mockImplementation((_: string, settlementId: string) => {
      if (settlementId === "settlement-1") return Promise.resolve({ incomeLines: [], expenseLines: [] });
      return new Promise(() => {});
    });

    renderPage();

    expect(await screen.findByDisplayValue("Header Uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("#00002"));

    expect(await screen.findByText("Cargando detalle de la rendicion...")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Header Uno")).not.toBeInTheDocument();
  });

  it("allows submit permission without edit and does not save first", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.submit"];

    renderPage();

    expect(await screen.findByText("Encabezado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Presentar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.submitSettlement).toHaveBeenCalledWith("settlement-1"));
    expect(mocks.saveSettlementDraft).not.toHaveBeenCalled();
  });

  it("saves editable changes through the RPC before submitting", async () => {
    renderPage();

    const preparedBy = await screen.findByLabelText("Preparado por");
    fireEvent.change(preparedBy, { target: { value: "Header Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /Presentar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.saveSettlementDraft).toHaveBeenCalledWith(expect.objectContaining({
      settlementId: "settlement-1",
      headerForm: expect.objectContaining({ prepared_by_name: "Header Editado" }),
    })));
    expect(mocks.submitSettlement).toHaveBeenCalledWith("settlement-1");
  });

  it("shows line totals as cash plus other amounts", async () => {
    mocks.fetchSettlementLines.mockResolvedValue({
      incomeLines: [{
        id: "income-1",
        company_id: "company-1",
        settlement_id: "settlement-1",
        line_date: "2026-06-18",
        work_order: null,
        receipt: "R-1",
        quote: "P-1",
        customer_name: "Cliente",
        concept: "Cobro",
        cash_amount: 100,
        other_amount: 50,
        income_type: null,
        display_order: 1,
      }],
      expenseLines: [{
        id: "expense-1",
        company_id: "company-1",
        settlement_id: "settlement-1",
        line_date: "2026-06-18",
        receipt: "F-1",
        supplier_name: "Proveedor",
        detail: "Gasto",
        purchase_order: null,
        cash_amount: 20,
        other_amount: 5,
        display_order: 1,
      }],
    });

    renderPage();

    expect(await screen.findByDisplayValue("Cliente")).toBeInTheDocument();
    const incomeTotals = await screen.findAllByText(amountText("150,00"));
    expect(incomeTotals.length).toBeGreaterThan(0);
    expect(screen.getAllByText(amountText("25,00")).length).toBeGreaterThan(0);
  });
});
