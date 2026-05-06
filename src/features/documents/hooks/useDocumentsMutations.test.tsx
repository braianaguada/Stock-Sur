import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { useDocumentsMutations } from "./useDocumentsMutations";

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
