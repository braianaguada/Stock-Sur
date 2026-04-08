import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Package, Truck, type LucideIcon } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";

type UseDashboardStatsOptions = {
  companyId: string | null | undefined;
};

export function useDashboardStats({ companyId }: UseDashboardStatsOptions) {
  const itemsCountQuery = useQuery({
    queryKey: queryKeys.dashboard.itemsCount(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { count } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!);
      return count ?? 0;
    },
  });

  const suppliersCountQuery = useQuery({
    queryKey: queryKeys.dashboard.suppliersCount(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { count } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!);
      return count ?? 0;
    },
  });

  const quotesCountQuery = useQuery({
    queryKey: queryKeys.dashboard.quotesCount(companyId ?? null),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { count } = await supabase
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!);
      return count ?? 0;
    },
  });

  const stats = useMemo<Array<{ label: string; value: number; icon: LucideIcon; hint: string }>>(() => [
    {
      label: "Items",
      value: itemsCountQuery.data ?? 0,
      icon: Package,
      hint: "Catalogo operativo listo para vender y comprar.",
    },
    {
      label: "Proveedores",
      value: suppliersCountQuery.data ?? 0,
      icon: Truck,
      hint: "Relaciones comerciales activas y listas para importar.",
    },
    {
      label: "Presupuestos",
      value: quotesCountQuery.data ?? 0,
      icon: FileText,
      hint: "Documentos comerciales generados desde el sistema.",
    },
  ], [itemsCountQuery.data, quotesCountQuery.data, suppliersCountQuery.data]);

  return { stats };
}
