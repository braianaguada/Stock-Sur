import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePriceListsData } from "./use-price-lists-data";

const mocks = vi.hoisted(() => ({ company: { id: "company-a" }, rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentCompany: mocks.company, user: { id: "actor" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
const params = {
  basePage: 3, basePageSize: 10, baseSearch: "cobre", detailPage: 2, detailPageSize: 10,
  detailSearch: "valvula", listSearch: "", selectedListId: "list-a", stockFilter: "in_stock" as const,
  baseEnabled: true, detailEnabled: false, itemIdFromQuery: null,
  priceRoundingConfig: { enabled: false, increment: 100 as const },
};
function setup(initial = params) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook((props) => usePriceListsData(props), {
    initialProps: initial,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.company = { id: "company-a" };
  mocks.from.mockImplementation(() => {
    const builder: Record<string, unknown> = {};
    for (const key of ["select", "eq", "order", "limit", "in"]) builder[key] = () => builder;
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return builder;
  });
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "list_pricing_items_page"
    ? { items: [{ item_id: "visible-item", stock: 5 }], page: 3, totalItems: 1205, totalPages: 121 }
    : { counts: [], marginSummary: null }, error: null }));
});
describe("pricing server pages", () => {
  it("sends page/search/stock to SQL and does not download catalog or movements", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.basePagination.totalItems).toBe(1205));
    expect(mocks.rpc).toHaveBeenCalledWith("list_pricing_items_page", expect.objectContaining({
      p_company_id: "company-a", p_page: 3, p_page_size: 10, p_search: "cobre", p_stock_filter: "in_stock", p_list_id: null,
    }));
    expect(result.current.stockByItemId.get("visible-item")).toBe(5);
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["price_lists"]);
  });
  it("loads only the opened list and replaces the company cache context", async () => {
    const { result, rerender } = setup({ ...params, baseEnabled: false, detailEnabled: true });
    await waitFor(() => expect(result.current.detailPagination.totalItems).toBe(1205));
    expect(mocks.rpc).toHaveBeenCalledWith("list_pricing_items_page", expect.objectContaining({ p_list_id: "list-a", p_page: 2 }));
    mocks.company = { id: "company-b" };
    rerender({ ...params, baseEnabled: false, detailEnabled: true, selectedListId: "list-b" });
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("list_pricing_items_page", expect.objectContaining({ p_company_id: "company-b", p_list_id: "list-b" })));
  });
});
