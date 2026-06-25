import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import PriceListsPage from "./PriceLists";

const { setSearchParams, recalculateMutate, priceListsData } = vi.hoisted(() => ({
  setSearchParams: vi.fn(),
  recalculateMutate: vi.fn(),
  priceListsData: {
    baseRows: [],
    pagedBaseRows: [],
    priceLists: [
      {
        id: "list-1",
        name: "Mayorista",
        description: "Lista principal",
        flete_pct: 5,
        utilidad_pct: 10,
        impuesto_pct: 21,
        status: "UPDATED",
        last_recalculated_at: "2026-05-12T00:00:00.000Z",
        last_recalculated_by: "user-1",
        updated_at: "2026-05-12T00:00:00.000Z",
        updated_by: "user-1",
        created_at: "2026-05-12T00:00:00.000Z",
        created_by: "user-1",
        pending_items_count: 1,
        total_items_count: 25,
      },
    ],
    profileNameByUserId: new Map([["user-1", "Usuario Demo"]]),
    selectedList: {
      id: "list-1",
      name: "Mayorista",
      description: "Lista principal",
      flete_pct: 5,
      utilidad_pct: 10,
      impuesto_pct: 21,
      status: "UPDATED",
      last_recalculated_at: "2026-05-12T00:00:00.000Z",
      last_recalculated_by: "user-1",
      updated_at: "2026-05-12T00:00:00.000Z",
      updated_by: "user-1",
      created_at: "2026-05-12T00:00:00.000Z",
      created_by: "user-1",
      pending_items_count: 1,
      total_items_count: 25,
    },
    selectedListHistory: [],
    pagedSelectedListProducts: [],
    snapshotsByListAndItemId: new Map([["list-1", new Map([["item-1", {}]])]]),
    updateBaseCostMutation: { isPending: false, mutate: vi.fn() },
    createListMutation: { isPending: false, mutate: vi.fn() },
    updateListConfigMutation: { isPending: false, mutate: vi.fn() },
    recalculateMutation: { isPending: false, mutate: vi.fn() },
    deleteListMutation: { isPending: false, mutate: vi.fn() },
    basePagination: { page: 1, totalPages: 1, totalItems: 0 },
    detailPagination: { page: 1, totalPages: 1, totalItems: 0 },
  },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/common/CompanyAccessNotice", () => ({
  CompanyAccessNotice: ({ description }: { description: string }) => <div>{description}</div>,
}));

vi.mock("@/components/ui/page", () => ({
  DataCard: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({
    title,
    actions,
    tabs,
    activeTab,
    onTabChange,
  }: {
    title: string;
    actions?: ReactNode;
    tabs?: Array<{ label: string; value: string }>;
    activeTab?: string;
    onTabChange?: (value: string) => void;
  }) => (
    <div>
      <div>{title}</div>
      {tabs?.map((tab) => (
        <button key={tab.value} type="button" aria-pressed={activeTab === tab.value} onClick={() => onTabChange?.(tab.value)}>
          {tab.label}
        </button>
      ))}
      {actions}
    </div>
  ),
}));

vi.mock("@/components/data-table/DataTablePagination", () => ({
  DataTablePagination: () => <div>Paginacion</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/features/price-lists/components/BasePricesTable", () => ({
  BasePricesTable: () => <div>Base prices table</div>,
}));

vi.mock("@/features/price-lists/components/PriceListCreateDialog", () => ({
  PriceListCreateDialog: () => null,
}));

vi.mock("@/features/price-lists/components/PriceListDetailDialog", () => ({
  PriceListDetailDialog: ({ open, selectedList }: { open: boolean; selectedList: { name: string } | null }) =>
    open ? <div>Detalle de {selectedList?.name ?? "lista"}</div> : null,
}));

vi.mock("@/components/common/ConfirmDeleteDialog", () => ({
  ConfirmDeleteDialog: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentCompany: { id: "company-1" },
    user: { id: "user-1" },
  }),
}));

vi.mock("@/contexts/company-brand-context", () => ({
  useCompanyBrand: () => ({
    settings: {
      price_rounding_enabled: false,
      price_rounding_increment: null,
    },
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => ({
      data: new Map<string, number>(),
      isLoading: false,
    }),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams("tab=lists&itemId=item-1"), setSearchParams],
  };
});

vi.mock("@/features/price-lists/use-price-lists-data", () => ({
  usePriceListsData: () => ({
    ...priceListsData,
    recalculateMutation: { isPending: false, mutate: recalculateMutate },
    updateProductOverrideMutation: { isPending: false, mutate: vi.fn() },
  }),
}));

describe("PriceListsPage", () => {
  beforeEach(() => {
    recalculateMutate.mockClear();
    setSearchParams.mockClear();
  });

  it("renders configured lists without the quick consultation table", () => {
    render(<PriceListsPage />);

    expect(screen.getByText("Listas configuradas")).toBeInTheDocument();
    expect(screen.getByText("Mayorista")).toBeInTheDocument();
    expect(screen.queryByText("Consulta rapida de precios")).not.toBeInTheDocument();
  });

  it("keeps view and recalculate actions available", () => {
    render(<PriceListsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Ver lista" }));
    expect(screen.getByText("Detalle de Mayorista")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Recalcular/i }));
    expect(recalculateMutate).toHaveBeenCalledWith("list-1");
  });

  it("handles itemId navigation without breaking the screen", () => {
    render(<PriceListsPage />);

    expect(screen.getByText("itemId activo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver lista sugerida" })).toBeInTheDocument();
  });
});
