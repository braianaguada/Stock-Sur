import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrintModelButton } from "./PrintModelButton";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn(), brandCompany: "company-1", permissions: ["suppliers.edit"] as string[], roles: ["user"] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentCompany: { id: "company-1" }, companyPermissionCodes: mocks.permissions, roles: mocks.roles }) }));
vi.mock("@/contexts/company-brand-context", () => ({ useCompanyBrand: () => ({ isLoading: false, settings: { company_id: mocks.brandCompany, app_name: "QA" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

function popup() {
  return { opener: null, closed: false, document: { write: vi.fn(), open: vi.fn(), close: vi.fn(), images: [] }, close: vi.fn(), focus: vi.fn(), print: vi.fn() };
}

describe("PrintModelButton", () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.toast.mockReset(); mocks.brandCompany = "company-1"; mocks.permissions = ["suppliers.edit"]; mocks.roles = ["user"]; });
  afterEach(() => vi.restoreAllMocks());

  it("provides the print action in both Documents and Purchase Orders headers", () => {
    for (const page of ["Documents", "PurchaseOrders"]) {
      const source = readFileSync(`src/pages/${page}.tsx`, "utf8");
      expect(source).toMatch(/actions=\{[\s\S]*?<PrintModelButton key=\{/);
    }
  });

  it("keeps the action visible and explains missing permission without allocating numbers", () => {
    mocks.permissions = [];
    render(<PrintModelButton />);
    const button = screen.getByRole("button", { name: "Imprimir órdenes de compra" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Necesitás permiso para editar proveedores/)).toBeVisible();
    fireEvent.click(button);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows an effective superadmin without explicit supplier permissions", async () => {
    mocks.roles = ["user", "superadmin"];
    mocks.permissions = [];
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    mocks.rpc.mockResolvedValue({ data: { firstNumber: 1, secondNumber: 2, sheetCount: 1, lastNumber: 2 }, error: null });
    render(<PrintModelButton />);
    fireEvent.click(screen.getByRole("button", { name: /Imprimir/ }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(1));
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_purchase_order_print_sheets", { p_company_id: "company-1", p_request_id: expect.any(String), p_sheet_count: 1 });
  });

  it("does not reserve numbers using another company's branding", () => {
    mocks.brandCompany = "company-2";
    render(<PrintModelButton />);
    expect(screen.getByRole("button", { name: "Imprimir órdenes de compra" })).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reprints the same sheet without allocating more numbers", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    mocks.rpc.mockResolvedValue({ data: { firstNumber: 1, secondNumber: 2, sheetCount: 1, lastNumber: 2 }, error: null });
    render(<PrintModelButton />);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir órdenes de compra" }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Reimprimir mismo lote" }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(2));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_purchase_order_print_sheets", { p_company_id: "company-1", p_request_id: expect.any(String), p_sheet_count: 1 });
  });

  it("closes pending previews when leaving the company context", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<PrintModelButton />);
    fireEvent.click(screen.getByRole("button", { name: "Imprimir órdenes de compra" }));
    view.unmount();
    await act(async () => { resolve({ data: { firstNumber: 1, secondNumber: 2, sheetCount: 1, lastNumber: 2 }, error: null }); });
    expect(win.close).toHaveBeenCalled();
    expect(win.print).not.toHaveBeenCalled();
    expect(win.document.write).toHaveBeenCalledTimes(1);
  });

  it("reserves the chosen sheet count and reprints that batch after changing the next quantity", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    mocks.rpc.mockResolvedValue({ data: { firstNumber: 11, secondNumber: 12, sheetCount: 3, lastNumber: 16 }, error: null });
    render(<PrintModelButton />);
    fireEvent.change(screen.getByLabelText("Hojas A4"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Imprimir/ }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(1));
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_purchase_order_print_sheets", expect.objectContaining({ p_sheet_count: 3 }));
    const printedHtml = win.document.write.mock.calls[1][0];
    expect(new DOMParser().parseFromString(printedHtml, "text/html").querySelectorAll("main.page")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Hojas A4"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Reimprimir mismo lote" }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(2));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(win.document.write.mock.calls[3][0]).toBe(printedHtml);
  });
  it.each(["0", "101", "1.5", ""])("does not reserve invalid sheet quantity %s", value => {
    const open = vi.spyOn(window, "open");
    render(<PrintModelButton />);
    fireEvent.change(screen.getByLabelText("Hojas A4"), { target: { value } });
    expect(screen.getByRole("button", { name: /Imprimir/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Imprimir/ }));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retries a failed reservation with the original request and quantity", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Connection interrupted" } });
    render(<PrintModelButton />);
    fireEvent.change(screen.getByLabelText("Hojas A4"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Imprimir/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Hojas A4"), { target: { value: "5" } });
    mocks.rpc.mockResolvedValueOnce({ data: { firstNumber: 1, secondNumber: 2, sheetCount: 3, lastNumber: 6 }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Reimprimir mismo lote" }));
    await waitFor(() => expect(win.print).toHaveBeenCalled());
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[0]);
  });
});
