import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentsData } from "./useDocumentsData";
import { queryKeys } from "@/lib/query-keys";

const state = vi.hoisted(() => ({
  queries: [] as { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<Record<string, unknown>[]> }[],
  rows: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; filters: [string, unknown][]; orders: string[]; from: number }[],
  failFrom: Infinity,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: typeof state.queries[number]) => {
    state.queries.push(options);
    return {};
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const orders: string[] = [];
      const excluded: [string, unknown][] = [];
      const builder = {
        select: () => builder,
        eq: (field: string, value: unknown) => { filters.push([field, value]); return builder; },
        neq: (field: string, value: unknown) => { excluded.push([field, value]); return builder; },
        order: (field: string) => { orders.push(field); return builder; },
        limit: (count: number) => builder.range(0, count - 1),
        range: async (from: number, to: number) => {
          state.calls.push({ table, filters: [...filters], orders: [...orders], from });
          if (from >= state.failFrom) return { data: null, error: new Error("Fallo de pagina") };
          const rows = (state.rows[table] ?? []).filter(row =>
            filters.every(([field, value]) => row[field] === value)
            && excluded.every(([field, value]) => row[field] !== value));
          return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null };
        },
      };
      return builder;
    },
  },
}));

function getQuery(search = "", companyId: string | null = "company-a", filtered = false) {
  state.queries = [];
  renderHook(() => useDocumentsData({
    search,
    currentCompanyId: companyId,
    typeFilter: filtered ? "REMITO" : "ALL",
    statusFilter: filtered ? "EMITIDO" : "ALL",
    customerFilter: filtered ? "customer-a" : "ALL",
    technicianFilter: filtered ? "technician-a" : "ALL",
    selectedDocId: null,
    selectedPriceListId: "",
  }));
  return state.queries.find(query => JSON.stringify(query.queryKey) === JSON.stringify(
    queryKeys.documents.list(companyId, search, filtered ? "REMITO" : "ALL", filtered ? "EMITIDO" : "ALL",
      filtered ? "customer-a" : "ALL", filtered ? "technician-a" : "ALL"),
  ))!;
}

beforeEach(() => {
  state.calls = [];
  state.failFrom = Infinity;
  state.rows = {
    documents: Array.from({ length: 1205 }, (_, index) => ({
      id: `doc-${index}`, company_id: "company-a", doc_type: "REMITO", status: "EMITIDO",
      document_number: 5000 - index, customer_name: index === 1204 ? "Cliente historico" : "Cliente reciente",
      customer_id: "customer-a", technician_id: "technician-a",
    })),
  };
});

describe("historial completo de documentos", () => {
  it("recupera mas de 300 y 1000 documentos con filtros y orden estable en cada pagina", async () => {
    state.rows.documents.push({ id: "foreign", company_id: "company-b" });
    const rows = await getQuery("", "company-a", true).queryFn();
    expect(rows).toHaveLength(1205);
    expect(rows[rows.length - 1]?.id).toBe("doc-1204");
    expect(state.calls.map(call => call.from)).toEqual([0, 1000]);
    for (const call of state.calls) {
      expect(call.filters).toEqual([
        ["company_id", "company-a"], ["doc_type", "REMITO"], ["status", "EMITIDO"],
        ["customer_id", "customer-a"], ["technician_id", "technician-a"],
      ]);
      expect(call.orders).toEqual(["created_at", "id"]);
    }
  });

  it.each(["3796", "historico"])("encuentra un remito antiguo al buscar %s", async search => {
    expect(await getQuery(search).queryFn()).toEqual([state.rows.documents[1204]]);
  });

  it("separa las queries y los resultados al cambiar de empresa y deshabilita sin empresa", async () => {
    const first = getQuery();
    const second = getQuery("", "company-b");
    expect(first.queryKey).not.toEqual(second.queryKey);
    expect(await second.queryFn()).toEqual([]);
    expect(getQuery("", null).enabled).toBe(false);
  });

  it("rechaza el historial incompleto si falla una pagina posterior", async () => {
    state.failFrom = 1000;
    await expect(getQuery().queryFn()).rejects.toThrow("Fallo de pagina");
  });

  it("recupera los registros antiguos en caja sin incluir otras empresas ni anulados", async () => {
    state.rows.cash_sales = Array.from({ length: 2105 }, (_, index) => ({
      document_id: `doc-${index}`, company_id: "company-a", status: "ACTIVA",
    }));
    state.rows.cash_sales.push(
      { document_id: "foreign", company_id: "company-b", status: "ACTIVA" },
      { document_id: "cancelled", company_id: "company-a", status: "ANULADA" },
    );
    getQuery();
    const query = state.queries.find(item => JSON.stringify(item.queryKey)
      === JSON.stringify(queryKeys.documents.cashUsage("company-a")))!;
    const rows = await query.queryFn();
    expect(rows).toHaveLength(2105);
    expect(rows[rows.length - 1]?.document_id).toBe("doc-2104");
    expect(state.calls.map(call => call.from)).toEqual([0, 1000, 2000]);
    expect(state.calls.every(call => call.filters.some(([key, value]) => key === "company_id" && value === "company-a"))).toBe(true);
  });
});
