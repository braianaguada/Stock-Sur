import { describe, expect, it, vi } from "vitest";
import { registerCashSaleFromRemito } from "./registerCashSaleFromRemito";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
describe("registerCashSaleFromRemito", () => {
  it.each([undefined, " 0009-1818 "])("uses one atomic operation with optional invoice %s", async (externalInvoiceNumber) => {
    rpc.mockResolvedValueOnce({ data: { id: "sale" }, error: null });
    await registerCashSaleFromRemito({ companyId: "company", documentId: "doc", paymentMethod: "POINT", externalInvoiceNumber });
    expect(rpc).toHaveBeenLastCalledWith("register_cash_sale_from_remito_with_invoice", { p_company_id: "company", p_document_id: "doc", p_payment_method: "POINT", p_external_invoice_number: externalInvoiceNumber?.trim() || null });
  });
  it("surfaces a rejected registration", async () => {
    const error = new Error("Caja sin permiso"); rpc.mockResolvedValueOnce({ data: null, error });
    await expect(registerCashSaleFromRemito({ companyId: "company", documentId: "doc", paymentMethod: "POINT" })).rejects.toBe(error);
  });
});
