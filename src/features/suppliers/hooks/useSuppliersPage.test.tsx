import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useSuppliersPage } from "./useSuppliersPage";
import type { Supplier } from "../types";

vi.mock("../queries", () => ({
  fetchSuppliers: vi.fn().mockResolvedValue([]),
  fetchSupplierCatalogs: vi.fn().mockResolvedValue([]),
  fetchSupplierCatalogVersions: vi.fn().mockResolvedValue([]),
  fetchSupplierCatalogLines: vi.fn().mockResolvedValue([]),
  fetchSupplierReorderContext: vi.fn().mockResolvedValue({ lines: [], stockRows: [] }),
}));
vi.mock("@/features/purchase-orders/hooks", () => ({
  useSupplierPurchaseOrders: () => ({ data: [], isLoading: false }),
  useCreateSupplierPurchaseOrder: () => ({ isPending: false }),
}));

describe("supplier import company context", () => {
  it("closes the import and removes the previous supplier when the active company changes", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter><QueryClientProvider client={client}>{children}</QueryClientProvider></MemoryRouter>;
    const view = renderHook(({ companyId }) => useSuppliersPage({ companyId, toast: vi.fn() }), { initialProps: { companyId: "c1" }, wrapper });
    act(() => view.result.current.openCatalog({ id: "s1", name: "Proveedor A", is_active: true } as Supplier));
    act(() => view.result.current.startImport());
    expect(view.result.current.importOpen).toBe(true);
    view.rerender({ companyId: "c2" });
    expect(view.result.current.selectedSupplier).toBeNull();
    expect(view.result.current.importOpen).toBe(false);
    expect(view.result.current.catalogDialogOpen).toBe(false);
    expect(view.result.current.activeVersionId).toBeNull();
  });
});
