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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
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

    expect(await screen.findByText("Header Uno")).toBeInTheDocument();
    fireEvent.click(screen.getByText("#00002"));

    expect(await screen.findByText("Cargando detalle de la rendicion...")).toBeInTheDocument();
    expect(screen.queryByText("Header Uno")).not.toBeInTheDocument();
  });

  it("allows submit permission without edit and does not save first", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.submit"];

    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Presentar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(mocks.submitSettlement).toHaveBeenCalledWith("settlement-1"));
    expect(mocks.saveSettlementDraft).not.toHaveBeenCalled();
  });

  it("saves editable changes through the RPC before submitting", async () => {
    renderPage();

    await screen.findByText("Resumen de rendicion");
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
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

  it("blocks editing, selection and actions while saving and keeps the sent snapshot as original", async () => {
    const saveRequest = deferred<{ id: string }>();
    mocks.fetchSettlements.mockResolvedValue([
      settlement("settlement-1", 1, "Listado Uno"),
      settlement("settlement-2", 2, "Listado Dos"),
    ]);
    mocks.fetchSettlementDetail
      .mockResolvedValueOnce({ ...settlement("settlement-1", 1, "Header Uno"), totals: undefined })
      .mockResolvedValue({ ...settlement("settlement-1", 1, "Header Guardado"), totals: undefined });
    mocks.saveSettlementDraft.mockReturnValueOnce(saveRequest.promise);

    renderPage();

    await screen.findByText("Resumen de rendicion");
    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const preparedBy = await screen.findByLabelText("Preparado por");
    fireEvent.change(preparedBy, { target: { value: "Header Guardado" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => expect(mocks.saveSettlementDraft).toHaveBeenCalledWith(expect.objectContaining({
      headerForm: expect.objectContaining({ prepared_by_name: "Header Guardado" }),
    })));
    await waitFor(() => expect(screen.getByRole("button", { name: /Presentar/i })).toBeDisabled());

    expect((screen.getByLabelText("Preparado por") as HTMLInputElement).value).toBe("Header Guardado");
    fireEvent.click(screen.getByText("#00002"));

    expect(screen.getByLabelText("Preparado por")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Presentar/i })).toBeDisabled();
    expect((screen.getByLabelText("Preparado por") as HTMLInputElement).value).toBe("Header Guardado");
    expect(mocks.fetchSettlementDetail).not.toHaveBeenCalledWith("company-1", "settlement-2");

    saveRequest.resolve({ id: "settlement-1" });

    await waitFor(() => expect(screen.getByRole("button", { name: /Guardar/i })).toBeDisabled());
    await waitFor(() => expect(screen.queryByText("Cargando detalle de la rendicion...")).not.toBeInTheDocument());
    expect((screen.getByLabelText("Preparado por") as HTMLInputElement).value).toBe("Header Guardado");
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

  it("shows summary by default, enters edit mode and returns without showing unsaved changes as persisted", async () => {
    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.getByText("Header Uno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar/i }));
    const preparedBy = await screen.findByLabelText("Preparado por");
    fireEvent.change(preparedBy, { target: { value: "Header Sin Guardar" } });
    fireEvent.click(screen.getByRole("button", { name: /Ver resumen/i }));

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.getByText("Hay cambios sin guardar en el editor. Este resumen muestra el ultimo detalle persistido.")).toBeInTheDocument();
    expect(screen.getByText("Header Uno")).toBeInTheDocument();
    expect(screen.queryByText("Header Sin Guardar")).not.toBeInTheDocument();
  });

  it("hides edit controls without edit permission", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.submit"];

    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Presentar/i })).toBeEnabled();
  });

  it("does not show receive action without receive permission", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.submit", "settlements.cancel"];
    mocks.fetchSettlements.mockResolvedValue([{ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const }]);
    mocks.fetchSettlementDetail.mockResolvedValue({ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const, totals: undefined });

    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recibir/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anular/i })).toBeEnabled();
  });

  it("does not show cancel action without cancel permission", async () => {
    mocks.auth.companyPermissionCodes = ["settlements.view", "settlements.submit", "settlements.receive"];
    mocks.fetchSettlements.mockResolvedValue([{ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const }]);
    mocks.fetchSettlementDetail.mockResolvedValue({ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const, totals: undefined });

    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recibir/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Anular/i })).not.toBeInTheDocument();
  });

  it("shows non draft settlements as historical detail instead of a disabled form", async () => {
    mocks.fetchSettlements.mockResolvedValue([{ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const }]);
    mocks.fetchSettlementDetail.mockResolvedValue({ ...settlement("settlement-1", 1, "Header Uno"), status: "SUBMITTED" as const, totals: undefined });
    mocks.fetchSettlementLines.mockResolvedValue({ incomeLines: [incomeLine()], expenseLines: [] });

    renderPage();

    expect(await screen.findByText("Resumen de rendicion")).toBeInTheDocument();
    expect(screen.getAllByText("Presentada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cliente").length).toBeGreaterThan(1);
    expect(screen.getByText("Cobro")).toBeInTheDocument();
    expect(screen.getAllByText(amountText("150,00")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar ingreso/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preparado por")).not.toBeInTheDocument();
  });
});
