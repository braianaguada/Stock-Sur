import { buildInitialServiceDocumentForm } from "../logic";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateServiceLineTotal, useServiceDocumentMutations as useMutations } from "./useServiceDocumentMutations";

const { rpc, invalidateQueries, toast, upload, attachmentSingle } = vi.hoisted(() => ({
  rpc: vi.fn(),
  upload: vi.fn(),
  attachmentSingle: vi.fn(),
  invalidateQueries: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (config: Record<string, unknown>) => config,
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/lib/query-keys", () => ({
  queryKeys: { serviceDocuments: {
    company: () => ["service-documents"],
    detail: (_companyId: string, id: string) => ["service-document", id],
    lines: (_companyId: string, id: string) => ["service-document-lines", id],
    attachments: (_companyId: string, id: string) => ["service-document-attachments", id],
    events: (_companyId: string, id: string) => ["service-document-events", id],
  } },
}));

vi.mock("@/features/services/db", () => ({
  serviceDb: { rpc, from: () => ({ insert: () => ({ select: () => ({ single: attachmentSingle }) }) }) },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ upload }) } } }));

vi.mock("@/lib/errors", () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "error"),
}));

function useServiceDocumentMutations(params: Parameters<typeof useMutations>[0]) {
  return renderHook(function TestHook() { return useMutations(params); }).result.current;
}

describe("useServiceDocumentMutations", () => {
  beforeEach(() => {
    rpc.mockReset();
    upload.mockReset();
    attachmentSingle.mockReset();
    invalidateQueries.mockReset();
    toast.mockReset();
  });

  it.each(["DRAFT", "SENT"] as const)("saves service documents with intent %s and trimmed payload", async (intent) => {
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

    await mutations.upsertMutation.mutationFn(intent);

    expect(rpc).toHaveBeenCalledWith(
      "save_service_document_with_sections",
      expect.objectContaining({
        p_company_id: "company-1",
        p_customer_id: "cust-1",
        p_status: intent,
        p_reference: "ref",
        p_delivery_time: "48 hs",
        p_payment_terms: "contado",
        p_delivery_location: "neuquen",
        p_intro_text: "intro",
        p_closing_text: "cierre",
        p_pricing_mode: "DETAILED",
        p_lines: [{ description: "Trabajo", line_type: "ITEM", quantity: 2, unit: "u", unit_price: 10, line_total: 20, is_bold: false, is_underlined: false }],
      }),
    );
  });

  it("keeps a draft on attachment failure and retries without creating another document or upload", async () => {
    rpc.mockResolvedValue({ data: { id: "doc-1", created_by: "user-1" }, error: null });
    upload.mockResolvedValue({ error: null });
    attachmentSingle.mockResolvedValueOnce({ error: new Error("metadata failed") }).mockResolvedValueOnce({ error: null });
    const mutations = useServiceDocumentMutations({
      companyId: "company-1", editingDocumentId: null, form: buildInitialServiceDocumentForm({}),
      lines: [{ description: "Trabajo", quantity: 1, unit: "u", unit_price: 10, line_total: 10 }] as never,
      attachments: [{ id: "attachment-1", file: new File(["image"], "image.jpg", { type: "image/jpeg" }), file_name: "image.jpg", mime_type: "image/jpeg", size_bytes: 5, title: "", description: "", sort_order: 1, include_in_print: true }],
      toast, onDone: vi.fn(),
    });
    await expect(mutations.upsertMutation.mutationFn("SENT")).rejects.toThrow("metadata failed");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenLastCalledWith("save_service_document_with_sections", expect.objectContaining({ p_status: "DRAFT", p_document_id: null }));
    await mutations.upsertMutation.mutationFn("SENT");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenNthCalledWith(2, "save_service_document_with_sections", expect.objectContaining({ p_document_id: "doc-1", p_status: "DRAFT" }));
    expect(rpc).toHaveBeenLastCalledWith("transition_service_document_status", { p_document_id: "doc-1", p_target_status: "SENT" });
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
        p_lines: [{ description: "Trabajo descriptivo", line_type: "ITEM", quantity: 1, unit: "u", unit_price: null, line_total: 0, is_bold: false, is_underlined: false }],
      }),
    );
  });

  it("rejects drafts that only contain titles or subtitles", async () => {
    const mutations = useServiceDocumentMutations({
      companyId: "company-1",
      editingDocumentId: null,
      form: {
        customer_id: "cust-1", status: "DRAFT", reference: "", issue_date: "2026-04-29", valid_until: "",
        intro_text: "", delivery_time: "", payment_terms: "", delivery_location: "", closing_text: "", currency: "ARS",
        exchange_rate_source: "BNA", exchange_rate: "", exchange_rate_date: "", exchange_rate_fetched_at: "",
        exchange_rate_snapshot_label: "", show_exchange_rate_note: true, pricing_mode: "DETAILED", global_total: "", hide_line_prices: false,
      },
      lines: [{ description: "Mano de obra", quantity: null, unit: null, unit_price: null, line_total: 0, sort_order: 1, line_type: "TITLE" }],
      toast,
      onDone: vi.fn(),
    });

    await expect(mutations.upsertMutation.mutationFn()).rejects.toThrow("al menos un item");
    expect(rpc).not.toHaveBeenCalled();
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
