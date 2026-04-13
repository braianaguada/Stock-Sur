import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Boxes,
  CircleDollarSign,
  FileText,
  PackageSearch,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";
import { buildDashboardInsights } from "@/features/index/dashboard-insights";

type UseDashboardStatsOptions = {
  companyId: string | null | undefined;
};

export function useDashboardStats({ companyId }: UseDashboardStatsOptions) {
  const overviewQuery = useQuery({
    queryKey: queryKeys.dashboard.overview(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const [
        { data: items, error: itemsError },
        { data: movements, error: movementsError },
        { data: pricingBase, error: pricingError },
        { count: suppliersCount, error: suppliersError },
        { count: quotesCount, error: quotesError },
      ] = await Promise.all([
        supabase
          .from("items")
          .select("id, name, sku, category, is_active")
          .eq("company_id", companyId!)
          .eq("is_active", true)
          .limit(5000),
        supabase
          .from("stock_movements")
          .select("item_id, type, quantity, created_at")
          .eq("company_id", companyId!)
          .limit(10000),
        supabase
          .from("item_pricing_base")
          .select("item_id, base_cost")
          .eq("company_id", companyId!),
        supabase
          .from("suppliers")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId!),
        supabase
          .from("quotes")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId!),
      ]);

      if (itemsError) throw itemsError;
      if (movementsError) throw movementsError;
      if (pricingError) throw pricingError;
      if (suppliersError) throw suppliersError;
      if (quotesError) throw quotesError;

      return buildDashboardInsights({
        items: items ?? [],
        movements: movements ?? [],
        pricingBase: pricingBase ?? [],
        suppliersCount: suppliersCount ?? 0,
        quotesCount: quotesCount ?? 0,
      });
    },
  });

  const dashboard = overviewQuery.data ?? buildDashboardInsights({
    items: [],
    movements: [],
    pricingBase: [],
    suppliersCount: 0,
    quotesCount: 0,
  });

  const stats = useMemo<Array<{ label: string; value: number; icon: LucideIcon; hint: string; tone: "info" | "success" | "warning" | "default" }>>(() => [
    {
      label: "Capital en mercaderia",
      value: dashboard.metrics.inventoryValue,
      icon: BadgeDollarSign,
      hint: "Valorizado con costo base sobre stock positivo.",
      tone: "info",
    },
    {
      label: "Items con stock",
      value: dashboard.metrics.itemsWithStock,
      icon: Boxes,
      hint: "Productos con existencia disponible hoy.",
      tone: "success",
    },
    {
      label: "Items sin costo",
      value: dashboard.metrics.itemsWithoutCost,
      icon: PackageSearch,
      hint: "Tienen stock pero todavia no entran en la valorizacion.",
      tone: dashboard.metrics.itemsWithoutCost > 0 ? "warning" : "default",
    },
    {
      label: "Proveedores activos",
      value: dashboard.metrics.suppliersCount,
      icon: Truck,
      hint: "Base comercial disponible para reponer.",
      tone: "default",
    },
    {
      label: "Presupuestos",
      value: dashboard.metrics.quotesCount,
      icon: FileText,
      hint: "Documentos comerciales generados en la app.",
      tone: "default",
    },
    {
      label: "Cobertura valorizada",
      value: dashboard.metrics.valuedItemsShare,
      icon: CircleDollarSign,
      hint: "Porcentaje de items con stock que ya tienen costo base.",
      tone: dashboard.metrics.valuedItemsShare >= 75 ? "success" : "warning",
    },
  ], [dashboard.metrics.inventoryValue, dashboard.metrics.itemsWithStock, dashboard.metrics.itemsWithoutCost, dashboard.metrics.quotesCount, dashboard.metrics.suppliersCount, dashboard.metrics.valuedItemsShare]);

  return {
    dashboard,
    stats,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
  };
}
