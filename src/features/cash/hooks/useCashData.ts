import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
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
  currentCompanyId: string | null;
};

export function useCashData({
  businessDate,
  detailDocumentId,
  selectedClosureId,
  situationFilter,
  currentCompanyId,
}: UseCashDataParams) {
  const qc = useQueryClient();

  const customersQuery = useQuery({
    queryKey: queryKeys.cash.customers(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, cuit")
        .eq("company_id", currentCompanyId!)
        .order("name")
        .limit(200);

      if (error) throw error;
      return (data ?? []) as CustomerOption[];
    },
  });

  const salesQuery = useQuery({
    queryKey: queryKeys.cash.sales(currentCompanyId, businessDate),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("company_id", currentCompanyId!)
        .eq("business_date", businessDate)
        .order("sold_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const remitosQuery = useQuery({
    queryKey: queryKeys.cash.remitos(currentCompanyId, businessDate),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, customer_id, customer_name, point_of_sale, document_number, issue_date, status, total, external_invoice_number, external_invoice_status")
        .eq("company_id", currentCompanyId!)
        .eq("doc_type", "REMITO")
        .eq("status", "EMITIDO")
        .eq("external_invoice_status", "ACTIVE")
        .eq("issue_date", businessDate)
        .order("document_number", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as RemitoOption[];
    },
  });

  const closureQuery = useQuery({
    queryKey: queryKeys.cash.closure(currentCompanyId, businessDate),
    enabled: Boolean(currentCompanyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_cash_closure", {
        p_business_date: businessDate,
        p_company_id: currentCompanyId!,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No se encontro el cierre del dia");
      return row as CashClosureRow;
    },
  });

  const linkedDocumentQuery = useQuery({
    queryKey: queryKeys.cash.linkedDocument(detailDocumentId),
    enabled: Boolean(detailDocumentId),
    queryFn: async () => {
      if (!detailDocumentId) return null;
      const { data, error } = await supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_name, total, notes, external_invoice_number, external_invoice_status")
        .eq("id", detailDocumentId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as DocumentQuickRow | null;
    },
  });

  const linkedDocumentLinesQuery = useQuery({
    queryKey: queryKeys.cash.linkedDocumentLines(detailDocumentId),
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
    queryKey: queryKeys.cash.linkedDocumentEvents(detailDocumentId),
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
    queryKey: queryKeys.cash.closuresHistory(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("id, business_date, status, expected_cash_remito_total, expected_cash_facturable_total, expected_services_remito_total, expected_sales_total, expected_cash_to_render, expected_point_sales_total, expected_transfer_sales_total, expected_account_sales_total, counted_cash_total, counted_point_total, counted_transfer_total, cash_difference, point_difference, transfer_difference, notes, closed_at")
        .eq("company_id", currentCompanyId!)
        .order("business_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []) as CashClosureHistoryRow[];
    },
  });

  const selectedClosureSalesQuery = useQuery({
    queryKey: queryKeys.cash.closureSales(currentCompanyId, selectedClosureId),
    enabled: Boolean(selectedClosureId && currentCompanyId),
    queryFn: async () => {
      if (!selectedClosureId) return [];
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, sold_at, business_date, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("company_id", currentCompanyId!)
        .eq("closure_id", selectedClosureId)
        .order("sold_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const sales = useMemo(() => salesQuery.data ?? [], [salesQuery.data]);
  const remitos = useMemo(() => remitosQuery.data ?? [], [remitosQuery.data]);
  const closuresHistory = useMemo(() => closuresHistoryQuery.data ?? [], [closuresHistoryQuery.data]);
  const closuresById = useMemo(
    () => new Map(closuresHistory.map((closure) => [closure.id, closure])),
    [closuresHistory],
  );
  const closuresByBusinessDate = useMemo(
    () => new Map(closuresHistory.map((closure) => [closure.business_date, closure])),
    [closuresHistory],
  );
  const summary = useMemo(() => buildCashSummary(sales), [sales]);
  const pendingSales = useMemo(
    () => sales.filter((sale) => sale.status === "PENDIENTE_COMPROBANTE"),
    [sales],
  );
  const closureHistoryForDate = useMemo(
    () => closuresByBusinessDate.get(businessDate) ?? null,
    [closuresByBusinessDate, businessDate],
  );
  const effectiveClosure = closureHistoryForDate ?? closureQuery.data ?? null;
  const hasClosedClosureForDay = effectiveClosure?.status === "CERRADO";
  const assignedRemitoIds = useMemo(
    () => new Set(
      sales
        .filter((sale) => sale.status !== "ANULADA" && sale.document_id)
        .map((sale) => sale.document_id as string),
    ),
    [sales],
  );
  const availableRemitos = useMemo(
    () => remitos.filter((remito) => !assignedRemitoIds.has(remito.id)),
    [remitos, assignedRemitoIds],
  );
  const availableFacturableRemitos = useMemo(
    () => availableRemitos.filter((remito) => remito.external_invoice_status === "ACTIVE" && Boolean(remito.external_invoice_number)),
    [availableRemitos],
  );
  const unclosedSalesAfterClosure = useMemo(
    () => sales.filter((sale) => sale.status !== "ANULADA" && !sale.closure_id),
    [sales],
  );
  const filteredSales = useMemo(
    () => sales.filter((sale) => {
      if (situationFilter === "TODAS") return true;
      if (situationFilter === "ANULADA") return sale.status === "ANULADA";
      const situation = getClosureSituation(sale, hasClosedClosureForDay).label;
      if (situationFilter === "PENDIENTE_CIERRE") return situation === "Pendiente de cierre";
      if (situationFilter === "EN_CAJA_CERRADA") return situation === "En caja cerrada";
      if (situationFilter === "POST_CIERRE") return situation === "Venta post cierre";
      return true;
    }),
    [sales, situationFilter, hasClosedClosureForDay],
  );
  const selectedClosurePreview = useMemo(
    () => (selectedClosureId ? closuresById.get(selectedClosureId) ?? null : null),
    [closuresById, selectedClosureId],
  );

  const refreshCash = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.cash.sales(currentCompanyId, businessDate) }),
      qc.invalidateQueries({ queryKey: queryKeys.cash.closure(currentCompanyId, businessDate) }),
      qc.invalidateQueries({ queryKey: queryKeys.cash.remitos(currentCompanyId, businessDate) }),
      qc.invalidateQueries({ queryKey: queryKeys.cash.closuresHistory(currentCompanyId) }),
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
    availableFacturableRemitos,
    refreshCash,
  };
}
