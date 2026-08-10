import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateServiceLineTotal, useServiceDocumentMutations } from "./useServiceDocumentMutations";

const { rpc, invalidateQueries, toast } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invalidateQueries: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (config: Record<string, unknown>) => config,
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/lib/query-keys", () => ({
  queryKeys: { serviceDocuments: { all: () => ["service-documents"] } },
}));

vi.mock("@/features/services/db", () => ({
  serviceDb: { rpc },
}));

vi.mock("@/lib/errors", () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "error"),
}));

describe("useServiceDocumentMutations", () => {
  beforeEach(() => {
    rpc.mockReset();
    invalidateQueries.mockReset();
    toast.mockReset();
  });

  it("saves service documents as drafts through rpc with trimmed payload", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    const mutations = useServiceDocumentMutations({
      companyId: "company-1",
      editingDocumentId: null,
      form: {
        customer_id: "cust-1",
        status: "APPROVED",
        reference: " ref ",
        issue_date: "2026-04-29",
        valid_until: "",
        intro_text: " intro ",
        delivery_time: " 48 hs ",
        payment_terms: " contado ",
        delivery_location: " neuquen ",
        closing_text: " cierre ",
        currency: "ARS",
        exchange_rate_source: "BNA",
        exchange_rate: "",
        exchange_rate_date: "",
        exchange_rate_fetched_at: "",
        exchange_rate_snapshot_label: "",
        show_exchange_rate_note: true,
        pricing_mode: "DETAILED",
        global_total: "",
        hide_line_prices: false,
      },
      lines: [
        { description: " Trabajo ", quantity: 2, unit: " u ", unit_price: 10, line_total: 0 },
        { description: " ", quantity: 1, unit: "u", unit_price: 10, line_total: 10 },
      ] as never,
      toast,
      onDone: vi.fn(),
    });

    await mutations.upsertMutation.mutationFn();

    expect(rpc).toHaveBeenCalledWith(
      "save_service_document_with_sections",
      expect.objectContaining({
        p_company_id: "company-1",
        p_customer_id: "cust-1",
        p_status: "DRAFT",
        p_reference: "ref",
        p_delivery_time: "48 hs",
        p_payment_terms: "contado",
        p_delivery_location: "neuquen",
        p_intro_text: "intro",
        p_closing_text: "cierre",
        p_pricing_mode: "DETAILED",
        p_lines: [{ description: "Trabajo", line_type: "ITEM", quantity: 2, unit: "u", unit_price: 10, line_total: 20 }],
      }),
    );
  });

  it("allows global total service documents without line prices", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "doc-1", created_by: "user-1" }, error: null });
    const mutations = useServiceDocumentMutations({
      companyId: "company-1",
      editingDocumentId: null,
      form: {
        customer_id: "cust-1",
        status: "DRAFT",
        reference: "",
        issue_date: "2026-04-29",
        valid_until: "",
        intro_text: "",
        delivery_time: "",
        payment_terms: "",
        delivery_location: "",
        closing_text: "",
        currency: "ARS",
        exchange_rate_source: "BNA",
        exchange_rate: "",
        exchange_rate_date: "",
        exchange_rate_fetched_at: "",
        exchange_rate_snapshot_label: "",
        show_exchange_rate_note: true,
        pricing_mode: "GLOBAL_TOTAL",
        global_total: "1500",
        hide_line_prices: true,
      },
      lines: [{ description: "Trabajo descriptivo", quantity: 1, unit: "u", unit_price: null, line_total: 0 }] as never,
      toast,
      onDone: vi.fn(),
    });

    await mutations.upsertMutation.mutationFn();

    expect(rpc).toHaveBeenCalledWith(
      "save_service_document_with_sections",
      expect.objectContaining({
        p_pricing_mode: "GLOBAL_TOTAL",
        p_global_total: 1500,
        p_hide_line_prices: true,
        p_lines: [{ description: "Trabajo descriptivo", line_type: "ITEM", quantity: 1, unit: "u", unit_price: null, line_total: 0 }],
      }),
    );
  });

  it("calls transition and copy rpcs for remito and duplicate flows", async () => {
    rpc.mockResolvedValue({ error: null });
    const mutations = useServiceDocumentMutations({
      companyId: "company-1",
      editingDocumentId: null,
      form: {
        customer_id: "cust-1",
        status: "DRAFT",
        reference: "",
        issue_date: "2026-04-29",
        valid_until: "",
        intro_text: "",
        delivery_time: "",
        payment_terms: "",
        delivery_location: "",
        closing_text: "",
        currency: "ARS",
        exchange_rate_source: "BNA",
        exchange_rate: "",
        exchange_rate_date: "",
        exchange_rate_fetched_at: "",
        exchange_rate_snapshot_label: "",
        show_exchange_rate_note: true,
        pricing_mode: "DETAILED",
        global_total: "",
        hide_line_prices: false,
      },
      lines: [{ description: "Trabajo", quantity: 1, unit: "u", unit_price: 10, line_total: 10 }] as never,
      toast,
      onDone: vi.fn(),
    });

    await mutations.duplicateMutation.mutationFn("doc-1");
    await mutations.convertToRemitoMutation.mutationFn("doc-2");
    await mutations.transitionMutation.mutationFn({ documentId: "doc-3", targetStatus: "APPROVED" });

    expect(rpc).toHaveBeenCalledWith("create_service_document_copy_with_sections", expect.objectContaining({ p_target_type: "QUOTE" }));
    expect(rpc).toHaveBeenCalledWith("create_service_document_copy_with_sections", expect.objectContaining({ p_target_type: "REMITO" }));
    expect(rpc).toHaveBeenCalledWith("transition_service_document_status", expect.objectContaining({ p_document_id: "doc-3", p_target_status: "APPROVED" }));
  });

  it("calculates service line totals defensively", () => {
    expect(calculateServiceLineTotal({ quantity: 2, unit_price: 10, line_total: 0 } as never)).toBe(20);
    expect(calculateServiceLineTotal({ quantity: 0, unit_price: 10, line_total: 15 } as never)).toBe(15);
    expect(calculateServiceLineTotal({ quantity: 2, unit_price: 0, line_total: 15 } as never)).toBe(15);
  });
});
