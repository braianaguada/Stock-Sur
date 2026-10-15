import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerQuickPriceConsultation } from "./ServerQuickPriceConsultation";
const state = vi.hoisted(() => ({ company: "company-a", rpc: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ currentCompany: { id: state.company } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("./QuickPriceConsultationDialog", () => ({ QuickPriceConsultationDialog: (p: {
  products: { name: string }[]; searchValue: string; onSearchChange: (v: string) => void;
  onPageChange: (v: number) => void; resultsError?: string; resultsLoading: boolean;
}) => <div>
  <input aria-label="search" value={p.searchValue} onChange={e => p.onSearchChange(e.target.value)} />
  <button onClick={() => p.onPageChange(2)}>next</button>
  {p.resultsLoading ? "loading" : p.products.map(r => r.name).join(",")}
  {p.resultsError ? <span role="alert">{p.resultsError}</span> : null}
</div> }));
const props = { open: true, priceLists: [], selectedListId: "list-a", onOpenChange: vi.fn(), onSelectedListIdChange: vi.fn() };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { client, node: (p = props) => <QueryClientProvider client={client}><ServerQuickPriceConsultation {...p} /></QueryClientProvider> };
}
beforeEach(() => { state.company = "company-a"; state.rpc.mockReset(); });
describe("server quick prices", () => {
  it("requests only the search and selected list, with real pages", async () => {
    state.rpc.mockResolvedValue({ data: { items: [{ item_id: "one", name: "Copper", stock: 3 }], hasMore: true }, error: null });
    const { node } = setup(); render(node());
    expect(state.rpc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "copper" } });
    await screen.findByText("Copper");
    expect(state.rpc).toHaveBeenLastCalledWith("search_quick_prices", { p_company_id: "company-a", p_price_list_id: "list-a", p_search: "copper", p_page: 1 });
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(state.rpc).toHaveBeenLastCalledWith("search_quick_prices", expect.objectContaining({ p_page: 2 })));
  });
  it("clears previous results when changing company, list or closing", async () => {
    state.rpc.mockResolvedValue({ data: { items: [{ item_id: "one", name: "Private price", stock: 3 }], hasMore: false }, error: null });
    const { node } = setup(); const view = render(node());
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "private" } });
    await screen.findByText("Private price");
    state.company = "company-b"; view.rerender(node());
    expect(screen.queryByText("Private price")).not.toBeInTheDocument();
    expect(screen.getByLabelText("search")).toHaveValue("");
    view.rerender(node({ ...props, selectedListId: "list-b" }));
    expect(state.rpc).toHaveBeenCalledTimes(1);
    view.rerender(node({ ...props, open: false }));
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it("shows query errors instead of an empty result", async () => {
    state.rpc.mockResolvedValue({ data: null, error: new Error("No permission") });
    const { node } = setup(); render(node());
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "product" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("No permission");
  });
});
