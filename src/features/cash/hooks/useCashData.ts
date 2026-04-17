import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDocumentNumber } from "@/lib/formatters";
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
  detailReceiptReference: string | null;
  selectedClosureId: string | null;
  situationFilter: SituationFilter;
  currentCompanyId: string | null;
};

export function useCashData({
  businessDate,
  detailDocumentId,
  detailReceiptReference,
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
      const [startOfDay, endOfDay] = [
        `${businessDate}T00:00:00-03:00`,
        `${businessDate}T23:59:59.999-03:00`,
      ];
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("company_id", currentCompanyId!)
        .gte("sold_at", startOfDay)
        .lte("sold_at", endOfDay)
        .order("sold_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const allSalesReferencesQuery = useQuery({
    queryKey: queryKeys.cash.sales(currentCompanyId, "all-references"),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, status, document_id, receipt_kind, receipt_reference")
        .eq("company_id", currentCompanyId!)
        .order("sold_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      return data ?? [];
    },
  });

  const remitosQuery = useQuery({
    queryKey: queryKeys.cash.remitos(currentCompanyId, businessDate),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, customer_id, customer_name, point_of_sale, document_number, issue_date, created_at, status, total, external_invoice_number, external_invoice_status")
        .eq("company_id", currentCompanyId!)
        .eq("doc_type", "REMITO")
        .eq("status", "EMITIDO")
        .order("document_number", { ascending: false })
        .limit(500);

      if (error) throw error;
      return ((data ?? []) as RemitoOption[]).filter((remito) => {
        const issueDateMatches = remito.issue_date === businessDate;
        const createdDateMatches = new Date(remito.created_at).toLocaleDateString("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
        }) === businessDate;
        return issueDateMatches || createdDateMatches;
      });
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
    queryKey: queryKeys.cash.linkedDocument(detailDocumentId ?? detailReceiptReference),
    enabled: Boolean(detailDocumentId || detailReceiptReference),
    queryFn: async () => {
      const baseQuery = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_name, total, notes, external_invoice_number, external_invoice_status");

      const query = detailDocumentId
        ? baseQuery.eq("id", detailDocumentId)
        : baseQuery
          .eq("company_id", currentCompanyId!)
          .eq("doc_type", "REMITO")
          .eq("external_invoice_status", "ACTIVE")
          .eq("external_invoice_number", detailReceiptReference!);

      const { data, error } = await query.maybeSingle();

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
  const salesReferenceRows = allSalesReferencesQuery.data ?? [];
  const assignedRemitoIds = useMemo(
    () => new Set(
      salesReferenceRows
        .filter((sale) => sale.status !== "ANULADA" && sale.document_id)
        .map((sale) => sale.document_id as string),
    ),
    [salesReferenceRows],
  );
  const remitoReferenceById = useMemo(
    () =>
      new Map(
        remitos.map((remito) => [
          remito.id,
          formatDocumentNumber(remito.point_of_sale, remito.document_number),
        ]),
      ),
    [remitos],
  );
  const usedReceiptReferences = useMemo(
    () => new Set(
      salesReferenceRows
        .filter((sale) => sale.status !== "ANULADA" && sale.receipt_reference)
        .map((sale) => sale.receipt_reference as string),
    ),
    [salesReferenceRows],
  );
  const availableRemitos = useMemo(
    () =>
      remitos.filter(
        (remito) =>
          !assignedRemitoIds.has(remito.id) &&
          !usedReceiptReferences.has(remitoReferenceById.get(remito.id) ?? "") &&
          !remito.external_invoice_number &&
          remito.external_invoice_status !== "ACTIVE",
      ),
    [remitos, assignedRemitoIds, usedReceiptReferences, remitoReferenceById],
  );
  const availableFacturableRemitos = useMemo(
    () =>
      remitos.filter(
        (remito) =>
          !assignedRemitoIds.has(remito.id) &&
          !usedReceiptReferences.has(remito.external_invoice_number ?? "") &&
          remito.external_invoice_status === "ACTIVE" &&
          Boolean(remito.external_invoice_number) &&
          !usedReceiptReferences.has(remito.external_invoice_number as string),
      ),
    [remitos, assignedRemitoIds, usedReceiptReferences],
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
    if (effectiveClosure?.status === "ABIERTO") {
      await supabase.rpc("recalculate_cash_closure_totals", {
        p_closure_id: effectiveClosure.id,
      });
    }

    await Promise.all([
      qc.refetchQueries({ queryKey: queryKeys.cash.sales(currentCompanyId, businessDate) }),
      qc.refetchQueries({ queryKey: queryKeys.cash.sales(currentCompanyId, "all-references") }),
      qc.refetchQueries({ queryKey: queryKeys.cash.closure(currentCompanyId, businessDate) }),
      qc.refetchQueries({ queryKey: queryKeys.cash.remitos(currentCompanyId, businessDate) }),
      qc.refetchQueries({ queryKey: queryKeys.cash.closuresHistory(currentCompanyId) }),
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
    salesError: salesQuery.error ?? allSalesReferencesQuery.error,
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
    usedReceiptReferences,
    refreshCash,
  };
}
