import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrintModelButton } from "./PrintModelButton";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), toast: vi.fn(), brandCompany: "company-1" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentCompany: { id: "company-1" }, companyPermissionCodes: ["suppliers.edit"] }) }));
vi.mock("@/contexts/company-brand-context", () => ({ useCompanyBrand: () => ({ isLoading: false, settings: { company_id: mocks.brandCompany, app_name: "QA" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

function popup() {
  return { opener: null, closed: false, document: { write: vi.fn(), open: vi.fn(), close: vi.fn(), images: [] }, close: vi.fn(), focus: vi.fn(), print: vi.fn() };
}

describe("PrintModelButton", () => {
  beforeEach(() => { mocks.rpc.mockReset(); mocks.toast.mockReset(); mocks.brandCompany = "company-1"; });
  afterEach(() => vi.restoreAllMocks());

  it("does not reserve numbers using another company's branding", () => {
    mocks.brandCompany = "company-2";
    render(<PrintModelButton />);
    expect(screen.getByRole("button", { name: /Imprimir 2/ })).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reprints the same sheet without allocating more numbers", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    mocks.rpc.mockResolvedValue({ data: { firstNumber: 1, secondNumber: 2 }, error: null });
    render(<PrintModelButton />);
    fireEvent.click(screen.getByRole("button", { name: /Imprimir 2/ }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Reimprimir misma hoja" }));
    await waitFor(() => expect(win.print).toHaveBeenCalledTimes(2));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_purchase_order_print_batch", { p_company_id: "company-1", p_request_id: expect.any(String) });
  });

  it("closes pending previews when leaving the company context", async () => {
    const win = popup();
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
    let resolve!: (value: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<PrintModelButton />);
    fireEvent.click(screen.getByRole("button", { name: /Imprimir 2/ }));
    view.unmount();
    await act(async () => { resolve({ data: { firstNumber: 1, secondNumber: 2 }, error: null }); });
    expect(win.close).toHaveBeenCalled();
    expect(win.print).not.toHaveBeenCalled();
    expect(win.document.write).toHaveBeenCalledTimes(1);
  });
});
