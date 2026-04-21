import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildItemDisplayName } from "@/lib/item-display";
import { DOC_LABEL } from "../constants";
import type {
  DocEventRow,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  PriceListItemRow,
  PriceListRow,
} from "../types";
import { formatNumber } from "../utils";

type UseDocumentsDataParams = {
  search: string;
  typeFilter: DocType | "ALL";
  statusFilter: DocStatus | "ALL";
  selectedDocId: string | null;
  selectedPriceListId: string;
  currentCompanyId: string | null;
};

export function useDocumentsData({
  search,
  typeFilter,
  statusFilter,
  selectedDocId,
  selectedPriceListId,
  currentCompanyId,
}: UseDocumentsDataParams) {
  const trimmedSearch = search.trim();
  const { data: customers = [] } = useQuery({
    queryKey: queryKeys.documents.customers(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, cuit")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: queryKeys.documents.items(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, sku, name, attributes, brand, model, unit")
        .eq("company_id", currentCompanyId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: queryKeys.documents.priceLists(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, flete_pct, utilidad_pct, impuesto_pct, round_mode, round_to")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PriceListRow[];
    },
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: queryKeys.documents.priceListItems(currentCompanyId, selectedPriceListId),
    enabled: !!selectedPriceListId && Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("item_id, is_active, base_cost, calculated_price, flete_pct, utilidad_pct, impuesto_pct, final_price_override, items(id, sku, name, attributes, brand, model, unit)")
        .eq("company_id", currentCompanyId!)
        .eq("price_list_id", selectedPriceListId)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PriceListItemRow[];
    },
  });

  const priceListsById = useMemo(
    () => new Map(priceLists.map((priceList) => [priceList.id, priceList])),
    [priceLists],
  );

  const selectedPriceList = useMemo(
    () => priceListsById.get(selectedPriceListId) ?? null,
    [priceListsById, selectedPriceListId],
  );

  const availableItems = useMemo(() => {
    if (!selectedPriceListId) {
      return items.map((item) => ({
        ...item,
        display_name: buildItemDisplayName({
          name: item.name,
          brand: "brand" in item ? (item.brand as string | null | undefined) : null,
          model: "model" in item ? (item.model as string | null | undefined) : null,
          attributes: "attributes" in item ? (item.attributes as string | null | undefined) : null,
        }),
      }));
    }
    return priceListItems
      .filter((row) => row.items)
      .map((row) => ({
        id: row.items!.id,
        sku: row.items!.sku,
        name: row.items!.name,
        display_name: buildItemDisplayName({
          name: row.items!.name,
          brand: row.items!.brand ?? null,
          model: row.items!.model ?? null,
          attributes: row.items!.attributes ?? null,
        }),
        brand: row.items!.brand ?? null,
        model: row.items!.model ?? null,
        attributes: row.items!.attributes ?? null,
        unit: row.items!.unit,
      }));
  }, [items, selectedPriceListId, priceListItems]);

  const priceByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of priceListItems) {
      if (row.final_price_override !== null && Number(row.final_price_override) > 0) {
        map.set(row.item_id, Number(row.final_price_override));
        continue;
      }
      map.set(row.item_id, Number(row.calculated_price) || 0);
    }
    return map;
  }, [priceListItems]);

  const priceListItemByItemId = useMemo(
    () => new Map(priceListItems.map((row) => [row.item_id, row])),
    [priceListItems],
  );

  const { data: documents = [], isLoading } = useQuery({
    queryKey: queryKeys.documents.list(currentCompanyId, trimmedSearch, typeFilter, statusFilter),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, customer_name, customer_tax_id, customer_tax_condition, customer_kind, internal_remito_type, payment_terms, delivery_address, salesperson, valid_until, price_list_id, source_document_id, source_document_type, source_document_number_snapshot, external_invoice_number, external_invoice_date, external_invoice_status, notes, subtotal, tax_total, total, created_at")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      if (typeFilter !== "ALL") q = q.eq("doc_type", typeFilter);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      if (trimmedSearch) {
        const n = Number.parseInt(trimmedSearch, 10);
        const clauses = [`customer_name.ilike.%${trimmedSearch}%`];
        if (Number.isFinite(n)) clauses.push(`document_number.eq.${n}`);
        q = q.or(clauses.join(","));
      }
      const { data, error } = await q.limit(300);
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const { data: selectedLines = [] } = useQuery({
    queryKey: queryKeys.documents.lines(selectedDocId),
    enabled: !!selectedDocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, item_id, line_order, description, quantity, unit, unit_price, line_total, sku_snapshot, pricing_mode, suggested_unit_price, base_cost_snapshot, list_flete_pct_snapshot, list_utilidad_pct_snapshot, list_impuesto_pct_snapshot, manual_margin_pct, price_overridden_by, price_overridden_at")
        .eq("document_id", selectedDocId!)
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as DocLineRow[];
    },
  });

  const { data: selectedEvents = [] } = useQuery({
    queryKey: queryKeys.documents.events(selectedDocId),
    enabled: !!selectedDocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_events")
        .select("id, event_type, payload, created_at")
        .eq("document_id", selectedDocId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocEventRow[];
    },
  });

  const selectedDocument = useMemo(
    () => (selectedDocId ? documentsById.get(selectedDocId) ?? null : null),
    [documentsById, selectedDocId],
  );

  const { data: selectedDocumentCashUsage = false } = useQuery({
    queryKey: ["documents", "cash-usage", selectedDocId],
    enabled: Boolean(selectedDocument?.doc_type === "REMITO" && selectedDocId && currentCompanyId),
    queryFn: async () => {
      if (!selectedDocument || !currentCompanyId) return false;

      const invoiceNumber = selectedDocument.external_invoice_number?.trim() ?? "";
      const queries = [
        supabase
          .from("cash_sales")
          .select("id", { count: "exact", head: true })
          .eq("company_id", currentCompanyId)
          .neq("status", "ANULADA")
          .eq("document_id", selectedDocument.id),
      ];

      if (invoiceNumber) {
        queries.push(
          supabase
            .from("cash_sales")
            .select("id", { count: "exact", head: true })
            .eq("company_id", currentCompanyId)
            .neq("status", "ANULADA")
            .eq("receipt_kind", "FACTURA")
            .eq("receipt_reference", invoiceNumber),
        );
      }

      const results = await Promise.all(queries);
      return results.some((result) => {
        if (result.error) throw result.error;
        return (result.count ?? 0) > 0;
      });
    },
  });

  const sourceDocument = useMemo(
    () => (selectedDocument?.source_document_id ? documentsById.get(selectedDocument.source_document_id) ?? null : null),
    [documentsById, selectedDocument?.source_document_id],
  );

  const sourceDocumentLabel = useMemo(() => {
    if (!selectedDocument?.source_document_id) return null;
    const sourceType = selectedDocument.source_document_type ?? sourceDocument?.doc_type ?? null;
    const sourceNumber = selectedDocument.source_document_number_snapshot
      ?? (sourceDocument ? formatNumber(sourceDocument.document_number, sourceDocument.point_of_sale) : null);
    if (!sourceType || !sourceNumber) return null;
    return `${DOC_LABEL[sourceType]} ${sourceNumber}`;
  }, [selectedDocument, sourceDocument]);

  return {
    customers,
    items,
    priceLists,
    priceListItems,
    selectedPriceList,
    availableItems,
    priceByItem,
    priceListItemByItemId,
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    selectedDocumentCashUsage,
    selectedDocument,
    sourceDocument,
    sourceDocumentLabel,
  };
}
