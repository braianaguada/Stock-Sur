import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { normalizeDraftLine, useDocumentsMutations } from "./useDocumentsMutations";
import type { DocumentFormState, LineDraft, PriceListItemRow } from "../types";

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
  useQueryClient: () => ({}),
  useMutation: (options: { mutationFn: () => Promise<unknown> }) => ({
    mutateAsync: options.mutationFn,
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
