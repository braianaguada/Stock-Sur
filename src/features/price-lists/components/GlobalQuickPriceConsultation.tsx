import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { ServerQuickPriceConsultation } from "@/features/price-lists/components/ServerQuickPriceConsultation";
import type { PriceListSummary } from "@/features/price-lists/types";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { fetchAllPages } from "@/lib/supabase-pagination";

const QUICK_PRICE_LIST_KEY = "price-lists:quick-list";

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
    enabled: Boolean(open && currentCompany && settings.quick_price_floating_enabled),
    queryFn: async () => {
      const data = await fetchAllPages(() => supabase
        .from("price_lists")
        .select("id, name, description, flete_pct, utilidad_pct, impuesto_pct, status, last_recalculated_at, last_recalculated_by, updated_at, updated_by, created_at, created_by")
        .eq("company_id", currentCompany!.id)
        .order("name"));
      return data as PriceListRow[];
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
      <ServerQuickPriceConsultation
        open={open}
        isLoading={listsQuery.isLoading}
        priceLists={priceLists}
        selectedListId={selectedListId}
        priceRoundingConfig={{ enabled: settings.price_rounding_enabled, increment: settings.price_rounding_increment }}
        onOpenChange={setOpen}
        onSelectedListIdChange={handleSelectedListIdChange}
      />
    </>
  );
}
