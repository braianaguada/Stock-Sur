import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildItemDisplayName } from "@/lib/item-display";
import { searchIncludes } from "@/lib/search";
import { fetchAllPages } from "@/lib/supabase-pagination";
import { DOC_LABEL } from "../constants";
import type {
  DocEventRow,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  DocumentServiceOption,
  PriceListItemRow,
  PriceListRow,
} from "../types";
import { formatNumber } from "../utils";
import type { ProductCombo, ProductComboLine } from "@/features/combos/types";

type UseDocumentsDataParams = {
  search: string;
  typeFilter: DocType | "ALL";
  statusFilter: DocStatus | "ALL";
  customerFilter: string;
  technicianFilter: string;
  selectedDocId: string | null;
  selectedPriceListId: string;
  currentCompanyId: string | null;
};

export function useDocumentsData({
  search,
  typeFilter,
  statusFilter,
  customerFilter,
  technicianFilter,
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
        .select("id, name, cuit, phone")
        .eq("company_id", currentCompanyId!)
        .eq("is_occasional", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allTechnicians = [] } = useQuery({
    queryKey: queryKeys.documents.technicians(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((technician) => ({ ...technician, is_active: technician.is_active ?? true }));
    },
  });
  const technicians = useMemo(
    () => allTechnicians.filter((technician) => technician.is_active !== false),
    [allTechnicians],
  );

  const { data: serviceOptions = [] } = useQuery({
    queryKey: ["documents", "service-options", currentCompanyId],
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_job_services")
        .select("id, title, status, job_id, service_jobs(id, title, customer_id, customers(id, name))")
        .eq("company_id", currentCompanyId!)
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).map((service) => {
        const job = Array.isArray(service.service_jobs) ? service.service_jobs[0] : service.service_jobs;
        const customer = Array.isArray(job?.customers) ? job?.customers[0] : job?.customers;
        return {
          id: service.id,
          title: service.title,
          status: service.status,
          job_id: service.job_id,
          jobTitle: job?.title ?? "Trabajo sin titulo",
          customerId: job?.customer_id ?? null,
          customerName: customer?.name ?? null,
        };
      }) as DocumentServiceOption[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: queryKeys.documents.items(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, sku, name, supplier, attributes, brand, model, category, unit")
        .eq("company_id", currentCompanyId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stockByItemId = new Map<string, number>() } = useQuery({
    queryKey: queryKeys.documents.itemStock(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    staleTime: 60_000,
    queryFn: async () => {
      const movements = await fetchAllPages(() =>
        supabase
          .from("stock_movements")
          .select("item_id, type, quantity")
          .eq("company_id", currentCompanyId!),
      );
      const totals = new Map<string, number>();
      for (const movement of movements) {
        const previous = totals.get(movement.item_id) ?? 0;
        const quantity = Number(movement.quantity);
        totals.set(
          movement.item_id,
          movement.type === "OUT" ? previous - quantity : previous + quantity,
        );
      }
      return totals;
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
        .select("item_id, is_active, base_cost, calculated_price, flete_pct, utilidad_pct, impuesto_pct, final_price_override, manual_price_enabled, manual_price_note")
        .eq("company_id", currentCompanyId!)
        .eq("price_list_id", selectedPriceListId)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PriceListItemRow[];
    },
  });

  const { data: combos = [] } = useQuery({
    queryKey: queryKeys.combos.list(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_combos")
        .select("id, company_id, name, description, is_active, created_at, updated_at, created_by")
        .eq("company_id", currentCompanyId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ProductCombo[];
    },
  });

  const { data: comboLines = [] } = useQuery({
    queryKey: ["product-combo-lines", currentCompanyId, combos.map((combo) => combo.id).join(",")],
    enabled: Boolean(currentCompanyId) && combos.length > 0,
    queryFn: async () => {
      const comboIds = combos.map((combo) => combo.id);
      const { data, error } = await supabase
        .from("product_combo_lines")
        .select("id, combo_id, item_id, quantity, line_order, notes, created_at")
        .in("combo_id", comboIds)
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as ProductComboLine[];
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
    const availableItemIds = new Set(priceListItems.map((row) => row.item_id));
    return items.filter((item) => !selectedPriceListId || availableItemIds.has(item.id)).map((item) => ({
      ...item,
      available_stock: stockByItemId.get(item.id) ?? 0,
      display_name: buildItemDisplayName({
        name: item.name,
        brand: "brand" in item ? (item.brand as string | null | undefined) : null,
        model: "model" in item ? (item.model as string | null | undefined) : null,
        attributes: "attributes" in item ? (item.attributes as string | null | undefined) : null,
      }),
    }));
  }, [items, priceListItems, selectedPriceListId, stockByItemId]);

  const priceByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of priceListItems) {
      if (row.manual_price_enabled && row.final_price_override !== null && Number(row.final_price_override) >= 0) {
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
    queryKey: queryKeys.documents.list(currentCompanyId, trimmedSearch, typeFilter, statusFilter, customerFilter, technicianFilter),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, technician_id, service_id, origin_document_id, customer_name, customer_tax_id, customer_tax_condition, customer_kind, internal_remito_type, payment_terms, delivery_address, salesperson, valid_until, price_list_id, source_document_id, source_document_type, source_document_number_snapshot, external_invoice_number, external_invoice_date, external_invoice_status, notes, subtotal, tax_total, total, created_at")
        .eq("company_id", currentCompanyId!)
        .order("created_at", { ascending: false });
      if (typeFilter !== "ALL") q = q.eq("doc_type", typeFilter);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      if (customerFilter !== "ALL") q = q.eq("customer_id", customerFilter);
      if (technicianFilter !== "ALL") q = q.eq("technician_id", technicianFilter);
      const { data, error } = await q.limit(300);
      if (error) throw error;
      const rows = (data ?? []) as DocRow[];
      if (!trimmedSearch) return rows;
      const numberQuery = Number.parseInt(trimmedSearch, 10);
      return rows.filter((document) =>
        searchIncludes(
          [
            document.customer_name,
            document.customer_tax_id,
            document.external_invoice_number,
            document.salesperson,
            document.payment_terms,
            document.delivery_address,
            document.notes,
            document.source_document_number_snapshot,
            document.doc_type,
            document.status,
            document.document_number != null ? String(document.document_number) : "",
          ].filter(Boolean).join(" "),
          trimmedSearch,
        ) || (Number.isFinite(numberQuery) && document.document_number === numberQuery),
      );
    },
  });

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const { data: selectedDocument = null } = useQuery({
    queryKey: queryKeys.documents.detail(currentCompanyId, selectedDocId),
    enabled: Boolean(currentCompanyId && selectedDocId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, technician_id, service_id, origin_document_id, customer_name, customer_tax_id, customer_tax_condition, customer_kind, internal_remito_type, payment_terms, delivery_address, salesperson, valid_until, price_list_id, source_document_id, source_document_type, source_document_number_snapshot, external_invoice_number, external_invoice_date, external_invoice_status, notes, subtotal, tax_total, total, created_at")
        .eq("company_id", currentCompanyId!)
        .eq("id", selectedDocId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DocRow | null;
    },
  });

  const { data: selectedLines = [] } = useQuery({
    queryKey: queryKeys.documents.lines(currentCompanyId, selectedDocId),
    enabled: Boolean(currentCompanyId && selectedDocId),
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
    queryKey: queryKeys.documents.events(currentCompanyId, selectedDocId),
    enabled: Boolean(currentCompanyId && selectedDocId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_events")
        .select("id, event_type, payload, created_at, created_by")
        .eq("document_id", selectedDocId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocEventRow[];
    },
  });

  const eventUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of selectedEvents) {
      if (event.created_by) ids.add(event.created_by);
    }
    return Array.from(ids).sort();
  }, [selectedEvents]);

  const { data: eventProfiles = [] } = useQuery({
    queryKey: ["documents", "event-profiles", currentCompanyId, eventUserIds],
    enabled: Boolean(currentCompanyId && eventUserIds.length > 0),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", eventUserIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const eventUserNamesById = useMemo(
    () => new Map(eventProfiles.map((profile) => [profile.user_id, profile.full_name?.trim() || "Usuario sin nombre"])),
    [eventProfiles],
  );

  const { data: cashUsages = [] } = useQuery({
    queryKey: queryKeys.documents.cashUsage(currentCompanyId),
    enabled: Boolean(currentCompanyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sales")
        .select("document_id, receipt_kind, receipt_reference")
        .eq("company_id", currentCompanyId!)
        .neq("status", "ANULADA")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cashRegisteredDocumentIds = useMemo(() => {
    const directIds = new Set(cashUsages.flatMap((usage) => usage.document_id ? [usage.document_id] : []));
    const invoiceReferences = new Set(
      cashUsages
        .filter((usage) => usage.receipt_kind === "FACTURA")
        .flatMap((usage) => usage.receipt_reference?.trim() ? [usage.receipt_reference.trim()] : []),
    );
    for (const document of documents) {
      if (document.external_invoice_number && invoiceReferences.has(document.external_invoice_number.trim())) {
        directIds.add(document.id);
      }
    }
    if (selectedDocument?.external_invoice_number && invoiceReferences.has(selectedDocument.external_invoice_number.trim())) {
      directIds.add(selectedDocument.id);
    }
    return directIds;
  }, [cashUsages, documents, selectedDocument]);

  const selectedDocumentCashUsage = Boolean(selectedDocId && cashRegisteredDocumentIds.has(selectedDocId));
  const selectedBusinessDate = selectedDocument?.issue_date ?? null;
  const { data: selectedDocumentClosureClosed = false } = useQuery({
    queryKey: queryKeys.documents.cashClosure(currentCompanyId, selectedBusinessDate),
    enabled: Boolean(currentCompanyId && selectedDocument?.doc_type === "REMITO" && selectedBusinessDate),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("status")
        .eq("company_id", currentCompanyId!)
        .eq("business_date", selectedBusinessDate!)
        .maybeSingle();
      if (error) throw error;
      return data?.status === "CERRADO";
    },
  });

  const sourceDocument = useMemo(
    () => (selectedDocument?.source_document_id ? documentsById.get(selectedDocument.source_document_id) ?? null : null),
    [documentsById, selectedDocument?.source_document_id],
  );

  const combosById = useMemo(() => new Map(combos.map((combo) => [combo.id, combo])), [combos]);
  const comboLinesByComboId = useMemo(() => {
    const map = new Map<string, ProductComboLine[]>();
    for (const line of comboLines) {
      const list = map.get(line.combo_id) ?? [];
      list.push(line);
      map.set(line.combo_id, list);
    }
    return map;
  }, [comboLines]);

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
    technicians,
    allTechnicians,
    serviceOptions,
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
    eventUserNamesById,
    selectedDocumentCashUsage,
    cashRegisteredDocumentIds,
    selectedDocumentClosureClosed,
    selectedDocument,
    sourceDocument,
    sourceDocumentLabel,
    combos,
    combosById,
    comboLinesByComboId,
  };
}
