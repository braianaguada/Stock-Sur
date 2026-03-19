import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { applyPriceListRounding, formatNumber } from "../utils";

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
    queryKey: ["documents-customers", currentCompanyId ?? "no-company"],
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
    queryKey: ["documents-items", currentCompanyId ?? "no-company"],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, sku, name, unit")
        .eq("company_id", currentCompanyId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["documents-price-lists", currentCompanyId ?? "no-company"],
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
    queryKey: ["documents-price-list-items", currentCompanyId ?? "no-company", selectedPriceListId],
    enabled: !!selectedPriceListId && Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("item_id, is_active, base_cost, flete_pct, utilidad_pct, impuesto_pct, final_price_override, items(id, sku, name, unit)")
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
    if (!selectedPriceListId) return items;
    return priceListItems
      .filter((row) => row.items)
      .map((row) => ({
        id: row.items!.id,
        sku: row.items!.sku,
        name: row.items!.name,
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
      if (!selectedPriceList) {
        map.set(row.item_id, 0);
        continue;
      }

      const baseCost = Number(row.base_cost) || 0;
      if (baseCost <= 0) {
        map.set(row.item_id, 0);
        continue;
      }

      const flete = row.flete_pct ?? selectedPriceList.flete_pct ?? 0;
      const utilidad = row.utilidad_pct ?? selectedPriceList.utilidad_pct ?? 0;
      const impuesto = row.impuesto_pct ?? selectedPriceList.impuesto_pct ?? 0;
      const computed = baseCost * (1 + flete / 100) * (1 + utilidad / 100) * (1 + impuesto / 100);
      map.set(row.item_id, applyPriceListRounding(computed, selectedPriceList.round_mode, selectedPriceList.round_to));
    }
    return map;
  }, [priceListItems, selectedPriceList]);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", currentCompanyId ?? "no-company", trimmedSearch, typeFilter, statusFilter],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, customer_name, customer_tax_id, customer_tax_condition, customer_kind, internal_remito_type, payment_terms, delivery_address, salesperson, valid_until, price_list_id, source_document_id, source_document_type, source_document_number_snapshot, notes, subtotal, tax_total, total, created_at")
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
    queryKey: ["document-lines", selectedDocId],
    enabled: !!selectedDocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, item_id, line_order, description, quantity, unit, unit_price, line_total, sku_snapshot")
        .eq("document_id", selectedDocId!)
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as DocLineRow[];
    },
  });

  const { data: selectedEvents = [] } = useQuery({
    queryKey: ["document-events", selectedDocId],
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
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    selectedDocument,
    sourceDocument,
    sourceDocumentLabel,
  };
}
