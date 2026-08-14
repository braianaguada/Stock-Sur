import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { QuickPriceConsultationDialog } from "@/features/price-lists/components/QuickPriceConsultationDialog";
import type { PriceListProductRow, PriceListSnapshot, PriceListSummary } from "@/features/price-lists/types";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { fetchAllPages } from "@/lib/supabase-pagination";

const QUICK_PRICE_LIST_KEY = "price-lists:quick-list";

type CatalogItem = {
  id: string;
  sku: string | null;
  name: string;
  attributes: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  unit: string | null;
};

type PriceListRow = Omit<PriceListSummary, "status" | "pending_items_count" | "total_items_count"> & {
  status: string;
};

export function GlobalQuickPriceConsultation() {
  const { currentCompany, user } = useAuth();
  const { settings } = useCompanyBrand();
  const [open, setOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const storageKey = currentCompany && user
    ? `${QUICK_PRICE_LIST_KEY}:${user.id}:${currentCompany.id}`
    : null;

  const listsQuery = useQuery({
    queryKey: queryKeys.pricing.lists(currentCompany?.id ?? null),
    enabled: Boolean(currentCompany),
    queryFn: async () => {
      const data = await fetchAllPages(() => supabase
        .from("price_lists")
        .select("id, name, description, flete_pct, utilidad_pct, impuesto_pct, status, last_recalculated_at, last_recalculated_by, updated_at, updated_by, created_at, created_by")
        .eq("company_id", currentCompany!.id)
        .order("name"));
      return data as PriceListRow[];
    },
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.pricing.catalogItems(currentCompany?.id ?? null),
    enabled: Boolean(open && currentCompany),
    queryFn: async () => {
      const data = await fetchAllPages(() => supabase
        .from("items")
        .select("id, sku, name, attributes, brand, model, category, unit")
        .eq("company_id", currentCompany!.id)
        .eq("is_active", true)
        .order("name"));
      return data as CatalogItem[];
    },
  });

  const snapshotsQuery = useQuery({
    queryKey: queryKeys.pricing.listProducts(currentCompany?.id ?? null, selectedListId),
    enabled: Boolean(open && currentCompany && selectedListId),
    queryFn: async () => {
      const data = await fetchAllPages(() => supabase
        .from("price_list_items")
        .select("price_list_id, item_id, base_cost, calculated_price, final_price_override, manual_price_enabled, manual_price_note, manual_price_updated_at, manual_price_updated_by, needs_recalculation, last_calculated_at, last_calculated_by")
        .eq("company_id", currentCompany!.id)
        .eq("price_list_id", selectedListId!)
        .eq("is_active", true));
      return data as PriceListSnapshot[];
    },
  });

  const stockQuery = useQuery({
    queryKey: ["items-stock-totals", currentCompany?.id ?? null],
    enabled: Boolean(open && currentCompany),
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await fetchAllPages(() => supabase
        .from("stock_movements")
        .select("item_id, type, quantity")
        .eq("company_id", currentCompany!.id));
      const totals = new Map<string, number>();
      for (const row of rows) {
        const previous = totals.get(row.item_id) ?? 0;
        const quantity = Number(row.quantity);
        totals.set(row.item_id, row.type === "OUT" ? previous - quantity : previous + quantity);
      }
      return totals;
    },
  });

  const priceLists = useMemo<PriceListSummary[]>(() => (listsQuery.data ?? []).map((row) => ({
    ...row,
    status: row.status === "UPDATED" ? "UPDATED" : "PENDING",
    pending_items_count: 0,
    total_items_count: 0,
  })), [listsQuery.data]);

  useEffect(() => {
    if (!storageKey || priceLists.length === 0) {
      setSelectedListId(null);
      return;
    }
    const savedListId = window.localStorage.getItem(storageKey);
    setSelectedListId((current) => {
      if (current && priceLists.some((list) => list.id === current)) return current;
      if (savedListId && priceLists.some((list) => list.id === savedListId)) return savedListId;
      return priceLists[0].id;
    });
  }, [priceLists, storageKey]);

  const products = useMemo<PriceListProductRow[]>(() => {
    const itemsById = new Map((catalogQuery.data ?? []).map((item) => [item.id, item]));
    return (snapshotsQuery.data ?? []).flatMap((snapshot) => {
      const item = itemsById.get(snapshot.item_id);
      if (!item) return [];
      return [{
        item_id: item.id,
        sku: item.sku,
        name: item.name,
        attributes: item.attributes,
        brand: item.brand,
        model: item.model,
        category: item.category,
        unit: item.unit,
        previous_base_cost: null,
        base_cost: Number(snapshot.base_cost),
        cost_variation_pct: null,
        calculated_price: Number(snapshot.calculated_price),
        final_price_override: snapshot.final_price_override === null ? null : Number(snapshot.final_price_override),
        manual_price_enabled: snapshot.manual_price_enabled,
        manual_price_note: snapshot.manual_price_note,
        manual_price_updated_at: snapshot.manual_price_updated_at,
        manual_price_updated_by: snapshot.manual_price_updated_by,
        needs_recalculation: snapshot.needs_recalculation,
        last_calculated_at: snapshot.last_calculated_at,
        last_calculated_by: snapshot.last_calculated_by,
      }];
    });
  }, [catalogQuery.data, snapshotsQuery.data]);

  if (!currentCompany || !settings.quick_price_floating_enabled) return null;

  const handleSelectedListIdChange = (priceListId: string) => {
    setSelectedListId(priceListId);
    if (storageKey) window.localStorage.setItem(storageKey, priceListId);
  };

  return (
    <>
      <Button
        type="button"
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full px-4 shadow-lg sm:bottom-6 sm:right-6"
        onClick={() => setOpen(true)}
        aria-label="Abrir consulta rapida de precios"
        title="Consulta rapida de precios"
      >
        <Tags className="h-5 w-5 sm:mr-2" />
        <span className="hidden sm:inline">Consulta rapida</span>
      </Button>
      <QuickPriceConsultationDialog
        open={open}
        isLoading={listsQuery.isLoading || catalogQuery.isLoading || snapshotsQuery.isLoading || stockQuery.isLoading}
        priceLists={priceLists}
        selectedListId={selectedListId}
        products={products}
        stockByItemId={stockQuery.data ?? new Map<string, number>()}
        priceRoundingConfig={{ enabled: settings.price_rounding_enabled, increment: settings.price_rounding_increment }}
        onOpenChange={setOpen}
        onSelectedListIdChange={handleSelectedListIdChange}
      />
    </>
  );
}
