import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentsData } from "./useDocumentsData";
import { useDocumentDraftLoader } from "./useDocumentDraftLoader";
import { queryKeys } from "@/lib/query-keys";

type Query = { queryKey: readonly unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
const state = vi.hoisted(() => ({
  queries: [] as Query[],
  results: new Map<string, { data?: unknown; error?: unknown }>(),
  rpc: vi.fn(),
  filters: [] as [string, unknown][],
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: Query) => {
    state.queries.push(options);
    return state.results.get(JSON.stringify(options.queryKey)) ?? {};
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: () => {
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => { state.filters.push([field, value]); return builder; },
        maybeSingle: async () => ({ data: null, error: null }),
      };
      return builder;
    },
  },
}));
const defaults = {
  currentCompanyId: "company-a", search: "", typeFilter: "ALL", statusFilter: "ALL",
  customerFilter: "ALL", technicianFilter: "ALL", dateFrom: "", dateTo: "",
  selectedDocId: null, selectedPriceListId: "", page: 1, pageSize: 10,
} satisfies Parameters<typeof useDocumentsData>[0];
function renderData(overrides: Partial<Parameters<typeof useDocumentsData>[0]> = {}) {
  return renderHook(() => useDocumentsData({ ...defaults, ...overrides }));
}
function listKey(company = "company-a", page = 1) {
  return queryKeys.documents.list(company, "", "ALL", "ALL", "ALL", "ALL", "", "", page, 10);
}
function query(prefix: string, id?: string) {
  return state.queries.find(q => q.queryKey[0] === prefix && (!id || q.queryKey.includes(id)))!;
}
beforeEach(() => {
  state.queries = []; state.results.clear(); state.filters = [];
  state.rpc.mockReset().mockResolvedValue({ data: { rows: [], total: 0, page: 1 }, error: null });
});
describe("server document pagination", () => {
  it("scopes draft loading outside the current page to the active company", async () => {
    const { result } = renderHook(() => useDocumentDraftLoader({ documentsById: new Map(), currentCompanyId: "company-a" }));
    await expect(result.current("old-draft")).rejects.toThrow("ya no esta disponible");
    expect(state.filters).toEqual([["company_id", "company-a"], ["id", "old-draft"]]);
  });
  it("rejects draft loading without an active company before querying", async () => {
    const { result } = renderHook(() => useDocumentDraftLoader({ documentsById: new Map(), currentCompanyId: null }));
    await expect(result.current("old-draft")).rejects.toThrow("Selecciona una empresa");
    expect(state.filters).toEqual([]);
  });
  it("requests one bounded page with all filters instead of fetching the history", async () => {
    renderData({ search: "  histórico  ", typeFilter: "REMITO", statusFilter: "EMITIDO",
      customerFilter: "customer-a", technicianFilter: "tech-a", dateFrom: "2026-09-01", dateTo: "2026-09-30", page: 4, pageSize: 25 });
    await query("documents", "histórico").queryFn();
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("list_documents_page", {
      p_company_id: "company-a", p_search: "histórico", p_type: "REMITO", p_status: "EMITIDO",
      p_customer_id: "customer-a", p_technician_id: "tech-a", p_date_from: "2026-09-01", p_date_to: "2026-09-30",
      p_page: 4, p_page_size: 25,
    });
  });
  it("uses the full server count and last-page clamp without slicing the page again", () => {
    state.results.set(JSON.stringify(listKey("company-a", 999)), { data: { rows: [{ id: "historical" }], total: 1201, page: 121 } });
    const { result } = renderData({ page: 999 });
    expect(result.current.documents).toEqual([{ id: "historical" }]);
    expect(result.current.documentsPagination).toEqual({ page: 121, totalPages: 121, totalItems: 1201, rangeStart: 1201, rangeEnd: 1201 });
  });
  it("isolates pages and companies and never retains another company's history", () => {
    state.results.set(JSON.stringify(listKey()), { data: { rows: [{ id: "private" }], total: 1, page: 1 } });
    expect(renderData().result.current.documents).toHaveLength(1);
    expect(renderData({ currentCompanyId: "company-b" }).result.current.documents).toEqual([]);
    expect(renderData({ page: 2 }).result.current.documents).toEqual([]);
    state.queries = []; renderData({ currentCompanyId: null });
    expect(state.queries.every(q => !q.enabled)).toBe(true);
  });
  it("propagates request failures instead of showing a partial history", async () => {
    const error = new Error("Connection interrupted");
    state.rpc.mockResolvedValue({ data: null, error });
    state.results.set(JSON.stringify(listKey()), { error });
    const { result } = renderData();
    await expect(query("documents", "ALL").queryFn()).rejects.toBe(error);
    expect(result.current.documentsError).toBe(error);
  });
  it("loads stock, items and pricing only when the document editor opens", () => {
    renderData();
    for (const prefix of ["documents-items", "documents-item-stock", "documents-price-lists", "product-combos"]) {
      expect(query(prefix).enabled).toBe(false);
    }
    state.queries = []; renderData({ editorOpen: true });
    for (const prefix of ["documents-items", "documents-item-stock", "documents-price-lists", "product-combos"]) {
      expect(query(prefix).enabled).toBe(true);
    }
  });
  it("checks cash only for visible and independently selected documents, deduplicated", async () => {
    state.results.set(JSON.stringify(listKey()), { data: { rows: [{ id: "b" }, { id: "a" }], total: 3000, page: 1 } });
    renderData({ selectedDocId: "a" });
    await state.queries.find(q => q.queryKey.includes("cash-usage"))!.queryFn();
    expect(state.rpc).toHaveBeenCalledWith("documents_page_cash_usage", { p_company_id: "company-a", p_document_ids: ["a", "b"] });
    state.queries = []; renderData({ selectedDocId: "outside-page" });
    await state.queries.find(q => q.queryKey.includes("cash-usage"))!.queryFn();
    expect(state.rpc).toHaveBeenLastCalledWith("documents_page_cash_usage", { p_company_id: "company-a", p_document_ids: ["a", "b", "outside-page"] });
  });
  it("fetches an old source document independently with a company filter", async () => {
    state.results.set(JSON.stringify(queryKeys.documents.detail("company-a", "selected")), {
      data: { id: "selected", source_document_id: "old-source" },
    });
    renderData({ selectedDocId: "selected" });
    const source = state.queries.find(q => q.queryKey.includes("old-source"))!;
    expect(source.enabled).toBe(true);
    await source.queryFn();
    expect(state.filters).toEqual([["company_id", "company-a"], ["id", "old-source"]]);
  });
});
