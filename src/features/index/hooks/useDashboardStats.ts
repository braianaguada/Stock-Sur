import { useQuery } from "@tanstack/react-query";
import { EMPTY_DASHBOARD, mergeDashboardInsights, normalizeDashboardInsights } from "@/features/index/dashboard-insights";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

type UseDashboardStatsOptions = {
  companyId: string | null | undefined;
  period?: { granularity: "day" | "week" | "month"; from: string; to: string };
};

export function useDashboardStats({ companyId, period }: UseDashboardStatsOptions) {
  const overviewQuery = useQuery({
    queryKey: queryKeys.dashboard.overview(companyId ?? null),
    enabled: Boolean(companyId),
    staleTime: 60_000,
    queryFn: async () => {
      const [overview, business] = await Promise.all([
        supabase.rpc("get_dashboard_operational_overview", { p_company_id: companyId! }),
        supabase.rpc("get_dashboard_business_insights", { p_company_id: companyId! }),
      ]);

      if (overview.error) throw overview.error;
      if (business.error) throw business.error;
      return mergeDashboardInsights(normalizeDashboardInsights(overview.data), business.data);
    },
  });

  const periodQuery = useQuery({
    queryKey: ["dashboard", "period", companyId ?? null, period?.granularity, period?.from, period?.to],
    enabled: Boolean(companyId && period),
    staleTime: 60_000,
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;
      const [timeseries, products] = await Promise.all([
        rpc("get_dashboard_timeseries", { p_company_id: companyId!, p_granularity: period!.granularity, p_from: period!.from, p_to: period!.to }),
        rpc("get_dashboard_period_product_insights", { p_company_id: companyId!, p_from: period!.from, p_to: period!.to }),
      ]);
      if (timeseries.error) throw timeseries.error;
      if (products.error) throw products.error;
      return { timeseries: timeseries.data, products: products.data };
    },
  });

  return {
    dashboard: overviewQuery.data ?? EMPTY_DASHBOARD,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    error: overviewQuery.error,
    hasData: overviewQuery.data !== undefined,
    dataUpdatedAt: overviewQuery.dataUpdatedAt,
    refetch: overviewQuery.refetch,
    periodData: periodQuery.data,
    isPeriodLoading: periodQuery.isLoading,
  };
}
