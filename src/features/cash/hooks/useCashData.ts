import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CashClosureHistoryRow,
  CashClosureRow,
  CashSaleRow,
  CustomerOption,
  DocumentEventQuickRow,
  DocumentLineQuickRow,
  DocumentQuickRow,
  RemitoOption,
  SituationFilter,
} from "../types";
import { buildCashSummary, getClosureSituation } from "../utils";

type UseCashDataParams = {
  businessDate: string;
  detailDocumentId: string | null;
  selectedClosureId: string | null;
  situationFilter: SituationFilter;
};

export function useCashData({
  businessDate,
  detailDocumentId,
  selectedClosureId,
  situationFilter,
}: UseCashDataParams) {
  const qc = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["cash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, cuit")
        .order("name")
        .limit(200);

      if (error) throw error;
      return (data ?? []) as CustomerOption[];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["cash-sales", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("business_date", businessDate)
        .order("sold_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const remitosQuery = useQuery({
    queryKey: ["cash-remitos", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, customer_id, customer_name, point_of_sale, document_number, issue_date, status")
        .eq("doc_type", "REMITO")
        .eq("status", "EMITIDO")
        .eq("issue_date", businessDate)
        .order("document_number", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as RemitoOption[];
    },
  });

  const closureQuery = useQuery({
    queryKey: ["cash-closure", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_cash_closure", { p_business_date: businessDate });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No se encontro el cierre del dia");
      return row as CashClosureRow;
    },
  });

  const linkedDocumentQuery = useQuery({
    queryKey: ["cash-linked-document", detailDocumentId],
    enabled: Boolean(detailDocumentId),
    queryFn: async () => {
      if (!detailDocumentId) return null;
      const { data, error } = await supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_name, total, notes")
        .eq("id", detailDocumentId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as DocumentQuickRow | null;
    },
  });

  const linkedDocumentLinesQuery = useQuery({
    queryKey: ["cash-linked-document-lines", detailDocumentId],
    enabled: Boolean(detailDocumentId),
    queryFn: async () => {
      if (!detailDocumentId) return [];
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, line_order, description, quantity, unit, unit_price, line_total")
        .eq("document_id", detailDocumentId)
        .order("line_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DocumentLineQuickRow[];
    },
  });

  const linkedDocumentEventsQuery = useQuery({
    queryKey: ["cash-linked-document-events", detailDocumentId],
    enabled: Boolean(detailDocumentId),
    queryFn: async () => {
      if (!detailDocumentId) return [];
      const { data, error } = await supabase
        .from("document_events")
        .select("id, event_type, payload, created_at")
        .eq("document_id", detailDocumentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentEventQuickRow[];
    },
  });

  const closuresHistoryQuery = useQuery({
    queryKey: ["cash-closures-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("id, business_date, status, expected_sales_total, expected_cash_to_render, expected_point_sales_total, expected_transfer_sales_total, counted_cash_total, counted_point_total, counted_transfer_total, cash_difference, point_difference, transfer_difference, notes, closed_at")
        .order("business_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []) as CashClosureHistoryRow[];
    },
  });

  const selectedClosureSalesQuery = useQuery({
    queryKey: ["cash-closure-sales", selectedClosureId],
    enabled: Boolean(selectedClosureId),
    queryFn: async () => {
      if (!selectedClosureId) return [];
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, sold_at, business_date, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("closure_id", selectedClosureId)
        .order("sold_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const sales = salesQuery.data ?? [];
  const remitos = remitosQuery.data ?? [];
  const closuresHistory = closuresHistoryQuery.data ?? [];
  const summary = buildCashSummary(sales);
  const pendingSales = sales.filter((sale) => sale.status === "PENDIENTE_COMPROBANTE");
  const closureHistoryForDate = closuresHistory.find((item) => item.business_date === businessDate) ?? null;
  const effectiveClosure = closureHistoryForDate ?? closureQuery.data ?? null;
  const hasClosedClosureForDay = effectiveClosure?.status === "CERRADO";
  const assignedRemitoIds = new Set(
    sales
      .filter((sale) => sale.status !== "ANULADA" && sale.document_id)
      .map((sale) => sale.document_id as string),
  );
  const availableRemitos = remitos.filter((remito) => !assignedRemitoIds.has(remito.id));
  const unclosedSalesAfterClosure = sales.filter((sale) => sale.status !== "ANULADA" && !sale.closure_id);
  const filteredSales = sales.filter((sale) => {
    if (situationFilter === "TODAS") return true;
    if (situationFilter === "ANULADA") return sale.status === "ANULADA";
    const situation = getClosureSituation(sale, hasClosedClosureForDay).label;
    if (situationFilter === "PENDIENTE_CIERRE") return situation === "Pendiente de cierre";
    if (situationFilter === "EN_CAJA_CERRADA") return situation === "En caja cerrada";
    if (situationFilter === "POST_CIERRE") return situation === "Venta post cierre";
    return true;
  });
  const selectedClosurePreview = closuresHistory.find((item) => item.id === selectedClosureId) ?? null;

  const refreshCash = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cash-sales", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-closure", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-remitos", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-closures-history"] }),
      salesQuery.refetch(),
      closureQuery.refetch(),
      remitosQuery.refetch(),
    ]);
  };

  return {
    customers: customersQuery.data ?? [],
    sales,
    remitos,
    closure: closureQuery.data ?? null,
    closureLoading: closureQuery.isLoading,
    closureError: closureQuery.error,
    salesLoading: salesQuery.isLoading,
    salesError: salesQuery.error,
    remitosError: remitosQuery.error,
    linkedDocument: linkedDocumentQuery.data ?? null,
    linkedDocumentLines: linkedDocumentLinesQuery.data ?? [],
    linkedDocumentEvents: linkedDocumentEventsQuery.data ?? [],
    closuresHistory,
    selectedClosureSales: selectedClosureSalesQuery.data ?? [],
    summary,
    pendingSales,
    effectiveClosure,
    hasClosedClosureForDay,
    availableRemitos,
    unclosedSalesAfterClosure,
    filteredSales,
    selectedClosurePreview,
    refreshCash,
  };
}
