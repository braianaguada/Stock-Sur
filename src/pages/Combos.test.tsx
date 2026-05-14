import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import CombosPage from "./Combos";

const { invalidateQueries, toast, rpc } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(async () => undefined),
  toast: vi.fn(),
  rpc: vi.fn(async () => ({ data: "combo-1", error: null })),
}));

const mockCombos = [
  {
    id: "combo-1",
    company_id: "company-1",
    name: "Combo demo",
    description: "Descripcion demo",
    is_active: true,
    created_at: "",
    updated_at: "",
    created_by: null,
  },
];

const mockItems = [
  {
    id: "item-1",
    sku: "SKU-1",
    name: "Producto A",
    unit: "un",
    brand: "Marca",
    category: "Categoria",
    is_active: true,
  },
];

const mockLines = [
  {
    id: "line-1",
    combo_id: "combo-1",
    item_id: "item-1",
    quantity: 2,
    line_order: 1,
    notes: "nota inicial",
    created_at: "",
  },
];

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentCompany: { id: "company-1" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "product_combos") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: async () => ({ data: mockCombos, error: null }),
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === "items") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: mockItems, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "product_combo_lines") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: mockLines, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    rpc,
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: ({ queryKey, enabled = true }: { queryKey: unknown[]; enabled?: boolean }) => {
      if (!enabled) return { data: [], isLoading: false };
      const key = queryKey[0];
      if (key === "product-combos") return { data: mockCombos, isLoading: false };
      if (key === "combos" && queryKey[1] === "items") return { data: mockItems, isLoading: false };
      if (key === "combos" && queryKey[1] === "lines") return { data: mockLines, isLoading: false };
      return { data: [], isLoading: false };
    },
    useMutation: (options: {
      mutationFn: () => Promise<string>;
      onSuccess?: (value: string) => void | Promise<void>;
      onError?: (error: unknown) => void;
    }) => ({
      mutate: async () => {
        try {
          const value = await options.mutationFn();
          await options.onSuccess?.(value);
        } catch (error) {
          options.onError?.(error);
        }
      },
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries,
    }),
  };
});

describe("CombosPage", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    rpc.mockClear();
    toast.mockClear();
  });

  it("updates the selected combo summary immediately while editing", async () => {
    render(<CombosPage />);

    expect(await screen.findByText("Producto A x 2")).toBeInTheDocument();

    const quantityInput = screen.getByDisplayValue("2");
    fireEvent.change(quantityInput, { target: { value: "5" } });

    expect(screen.getByText("Producto A x 5")).toBeInTheDocument();
  });

  it("invalidates combos and combo lines after saving", async () => {
    render(<CombosPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Guardar combo" }));

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["product-combos"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["combos", "lines"] });
    });
  });
});
