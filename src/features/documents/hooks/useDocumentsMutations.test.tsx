import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { normalizeDraftLine, useDocumentsMutations } from "./useDocumentsMutations";
import type { DocRow, DocumentFormState, LineDraft, PriceListItemRow } from "../types";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "doc-1" }, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: () => ({}) }) }),
      delete: () => ({ eq: () => ({}) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
    rpc: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  useMutation: (options: { mutationFn: (arg?: unknown) => Promise<unknown>; onSuccess?: (data: unknown, arg?: unknown) => unknown }) => ({
    mutateAsync: async (arg?: unknown) => { const data = await options.mutationFn(arg); await options.onSuccess?.(data, arg); return data; },
    isPending: false,
  }),
}));

describe("useDocumentsMutations", () => {
  it("does not reference an undefined draft form during validation", async () => {
    const wrapper = ({ children }: PropsWithChildren) => <>{children}</>;

    const { result } = renderHook(
      () =>
        useDocumentsMutations({
          currentCompanyId: "company-1",
          userId: "user-1",
          documents: [],
          customers: [],
          technicians: [],
          lines: [],
          draftForm: {
            doc_type: "PRESUPUESTO",
            point_of_sale: 1,
            customer_id: "",
            technician_id: "",
            customer_name: "",
            customer_tax_condition: "",
            customer_tax_id: "",
            customer_kind: "GENERAL",
            internal_remito_type: "",
            payment_terms: "",
            delivery_address: "",
            salesperson: "",
            valid_until: "",
            price_list_id: "",
            notes: "",
          },
          totalDraft: 0,
          editingDocId: null,
          priceByItem: new Map(),
          priceListItemByItemId: new Map(),
          priceRoundingConfig: { enabled: false, increment: null },
          resetDraftForm: vi.fn(),
          setDialogOpen: vi.fn(),
          toast: vi.fn(),
        }),
      { wrapper },
    );

    await expect(act(() => result.current.upsertDraftMutation.mutateAsync())).rejects.toThrow(
      "Agrega al menos una linea valida",
    );
  });
});

const baseDraftForm: DocumentFormState = {
  doc_type: "PRESUPUESTO",
  point_of_sale: 1,
  customer_id: "",
  technician_id: "",
  customer_name: "",
  customer_tax_condition: "",
  customer_tax_id: "",
  customer_kind: "GENERAL",
  internal_remito_type: "",
  payment_terms: "",
  delivery_address: "",
  salesperson: "",
  valid_until: "",
  price_list_id: "list-1",
  notes: "",
};

const baseLine: LineDraft = {
  item_id: "item-1",
  sku_snapshot: "SKU-1",
  description: "Producto",
  unit: "un",
  quantity: 2,
  unit_price: 1256.35,
  pricing_mode: "LIST_PRICE",
  suggested_unit_price: 1256.35,
  base_cost_snapshot: null,
  list_flete_pct_snapshot: null,
  list_utilidad_pct_snapshot: null,
  list_impuesto_pct_snapshot: null,
  manual_margin_pct: null,
  price_overridden_by: null,
  price_overridden_at: null,
};

const basePriceRow: PriceListItemRow = {
  item_id: "item-1",
  is_active: true,
  base_cost: 1000,
  calculated_price: 1256.35,
  flete_pct: 5,
  utilidad_pct: 10,
  impuesto_pct: 21,
  final_price_override: null,
  manual_price_enabled: false,
  manual_price_note: null,
  items: null,
};

describe("document submission intents", () => {
  it.each([
    ["SAVE_DRAFT", "PRESUPUESTO", null],
    ["SEND_BUDGET", "PRESUPUESTO", "transition_document_status"],
    ["ISSUE_REMITO", "REMITO", "issue_document"],
  ] as const)("routes %s through the correct operation", async (intent, docType, rpcName) => {
    vi.mocked(supabase.rpc).mockReset().mockResolvedValue({ data: null, error: null, count: null, status: 200, statusText: "OK" });
    const { result } = renderHook(() => useDocumentsMutations({
      currentCompanyId: "company-1", userId: "user-1", documents: [], customers: [], technicians: [], serviceOptions: [],
      lines: [baseLine], draftForm: { ...baseDraftForm, doc_type: docType, recipient_type: "OCCASIONAL", customer_name: "Cliente ocasional" },
      totalDraft: 2512.7, editingDocId: null, priceByItem: new Map([["item-1", 1256.35]]),
      priceListItemByItemId: new Map([["item-1", basePriceRow]]), priceRoundingConfig: { enabled: false, increment: null },
      resetDraftForm: vi.fn(), setDialogOpen: vi.fn(), toast: vi.fn(),
    }));
    let outcome: unknown;
    await act(async () => { outcome = await result.current.upsertDraftMutation.mutateAsync(intent); });
    expect(outcome).toEqual({ intent, documentId: "doc-1", issued: intent === "ISSUE_REMITO", issueError: null });
    if (rpcName) expect(supabase.rpc).toHaveBeenCalledWith(rpcName, intent === "SEND_BUDGET" ? { p_document_id: "doc-1", p_target_status: "ENVIADO" } : { p_document_id: "doc-1" });
    else expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("normalizeDraftLine", () => {
  it("keeps base cost unchanged and uses rounded suggested price as initial list price", () => {
    const line = normalizeDraftLine({
      line: baseLine,
      draftForm: baseDraftForm,
      priceByItem: new Map([["item-1", 1256.35]]),
      priceListItemByItemId: new Map([["item-1", basePriceRow]]),
      priceRoundingConfig: { enabled: true, increment: 500 },
      userId: "user-1",
      nowIso: "2026-05-08T00:00:00.000Z",
    });

    expect(line.base_cost_snapshot).toBe(1000);
    expect(line.suggested_unit_price).toBe(1500);
    expect(line.unit_price).toBe(1500);
  });

  it("respects manual price overrides when normalizing", () => {
    const line = normalizeDraftLine({
      line: { ...baseLine, pricing_mode: "MANUAL_PRICE", unit_price: 1400 },
      draftForm: baseDraftForm,
      priceByItem: new Map([["item-1", 1256.35]]),
      priceListItemByItemId: new Map([["item-1", basePriceRow]]),
      priceRoundingConfig: { enabled: true, increment: 500 },
      userId: "user-1",
      nowIso: "2026-05-08T00:00:00.000Z",
    });

    expect(line.suggested_unit_price).toBe(1500);
    expect(line.unit_price).toBe(1400);
    expect(line.price_overridden_by).toBe("user-1");
  });

  it("uses active product override without rounding", () => {
    const line = normalizeDraftLine({
      line: baseLine,
      draftForm: baseDraftForm,
      priceByItem: new Map([["item-1", 2100]]),
      priceListItemByItemId: new Map([
        [
          "item-1",
          { ...basePriceRow, calculated_price: 1850, final_price_override: 2100, manual_price_enabled: true },
        ],
      ]),
      priceRoundingConfig: { enabled: true, increment: 500 },
      userId: "user-1",
      nowIso: "2026-05-16T00:00:00.000Z",
    });

    expect(line.suggested_unit_price).toBe(2100);
    expect(line.unit_price).toBe(2100);
  });
});


describe("sale unit validation", () => {
  it("rejects fractions of whole units before saving a document", async () => {
    const { result } = renderHook(() => useDocumentsMutations({
      currentCompanyId: "company-1", userId: "user-1", documents: [], customers: [], technicians: [], serviceOptions: [],
      lines: [{ ...baseLine, quantity: 1.5 }], draftForm: { ...baseDraftForm, recipient_type: "OCCASIONAL", customer_name: "Cliente" },
      totalDraft: 1, editingDocId: null, priceByItem: new Map(), priceListItemByItemId: new Map(),
      priceRoundingConfig: { enabled: false, increment: null }, resetDraftForm: vi.fn(), setDialogOpen: vi.fn(), toast: vi.fn(),
    }));
    await expect(result.current.upsertDraftMutation.mutateAsync("SAVE_DRAFT")).rejects.toThrow("unidad entera");
  });
});


describe("budget approval and conversion", () => {
  it("creates the draft through one atomic RPC and propagates errors", async () => {
    const onRemitoCreated = vi.fn();
    const { result } = renderHook(() => useDocumentsMutations({
      currentCompanyId: "company-1", userId: "user-1", documents: [{ id: "budget-1" } as DocRow],
      customers: [], technicians: [], serviceOptions: [], lines: [], draftForm: baseDraftForm,
      totalDraft: 0, editingDocId: null, priceByItem: new Map(), priceListItemByItemId: new Map(),
      resetDraftForm: vi.fn(), setDialogOpen: vi.fn(), toast: vi.fn(), onRemitoCreated,
    }));
    vi.mocked(supabase.rpc).mockReset().mockResolvedValueOnce({ data: "remito-1", error: null, count: null, status: 200, statusText: "OK" });
    await expect(result.current.cloneAsRemitoMutation.mutateAsync("budget-1")).resolves.toBe("remito-1");
    expect(supabase.rpc).toHaveBeenCalledWith("approve_budget_create_remito", { p_document_id: "budget-1" });
    expect(onRemitoCreated).toHaveBeenCalledExactlyOnceWith("remito-1");
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error("Sin permiso"));
    await expect(result.current.cloneAsRemitoMutation.mutateAsync("budget-1")).rejects.toThrow("Sin permiso");
    await expect(result.current.cloneAsRemitoMutation.mutateAsync("other-company-budget")).rejects.toThrow("ya no esta disponible");
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(onRemitoCreated).toHaveBeenCalledTimes(1);
  });

  it.each(["REMITO", "REMITO_DEVOLUCION"] as const)("offers Cash after issuing %s only when it is a sale", async (doc_type) => {
    const onRemitoIssued = vi.fn();
    const { result } = renderHook(() => useDocumentsMutations({
      currentCompanyId: "company-1", userId: "user-1", documents: [{ id: "doc-1", doc_type, total: 1, origin_document_id: "original" } as DocRow],
      customers: [], technicians: [], serviceOptions: [], lines: [], draftForm: baseDraftForm,
      totalDraft: 0, editingDocId: null, priceByItem: new Map(), priceListItemByItemId: new Map(),
      resetDraftForm: vi.fn(), setDialogOpen: vi.fn(), toast: vi.fn(), onRemitoIssued,
    }));
    vi.mocked(supabase.rpc).mockReset().mockResolvedValueOnce({ data: null, error: null, count: null, status: 200, statusText: "OK" });
    await act(async () => { await result.current.issueMutation.mutateAsync("doc-1"); });
    expect(onRemitoIssued).toHaveBeenCalledTimes(doc_type === "REMITO" ? 1 : 0);
  });
});
