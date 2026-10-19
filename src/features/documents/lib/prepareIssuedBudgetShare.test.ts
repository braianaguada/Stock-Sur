import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareIssuedBudgetShare } from "./prepareIssuedBudgetShare";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
vi.mock("@/lib/public-app-url", () => ({ getPublicAppOrigin: () => "https://app.test" }));

describe("prepareIssuedBudgetShare", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const query = { select: mocks.select, eq: mocks.eq, single: mocks.single };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.single.mockResolvedValue({ data: {
      id: "budget-1", doc_type: "PRESUPUESTO", document_number: 123,
      point_of_sale: 9, total: 270000, customer_id: "customer-1",
    }, error: null });
    mocks.rpc.mockResolvedValue({ data: { token: "public-token", enabled: true }, error: null });
  });

  it("loads the emitted budget in the active company before creating a ready-to-copy message", async () => {
    const result = await prepareIssuedBudgetShare("company-1", "budget-1");
    expect(mocks.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(mocks.eq).toHaveBeenCalledWith("id", "budget-1");
    expect(mocks.eq).toHaveBeenCalledWith("doc_type", "PRESUPUESTO");
    expect(mocks.eq).toHaveBeenCalledWith("status", "ENVIADO");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("create_document_share_link", {
      p_document_id: "budget-1", p_expires_at: null,
    });
    expect(result.message).toContain("0009-00000123");
    expect(result.message).toContain("270.000,00");
    expect(result.message).toContain("https://app.test/public/document/public-token");
    expect(result.document.customer_id).toBe("customer-1");
  });

  it("does not create a public link when the company-scoped emitted budget cannot be loaded", async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error("Not found") });
    await expect(prepareIssuedBudgetShare("company-2", "budget-1")).rejects.toThrow("Not found");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not share an unnumbered document", async () => {
    mocks.single.mockResolvedValue({ data: { document_number: null }, error: null });
    await expect(prepareIssuedBudgetShare("company-1", "budget-1")).rejects.toThrow("no esta disponible");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reports link errors without issuing the budget again", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Permission denied") });
    await expect(prepareIssuedBudgetShare("company-1", "budget-1")).rejects.toThrow("Permission denied");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty link response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(prepareIssuedBudgetShare("company-1", "budget-1")).rejects.toThrow("No se pudo generar el enlace");
  });
});
