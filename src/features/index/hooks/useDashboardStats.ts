import { useQuery } from "@tanstack/react-query";
import { EMPTY_DASHBOARD, mergeDashboardInsights, normalizeDashboardInsights } from "@/features/index/dashboard-insights";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

type UseDashboardStatsOptions = {
  companyId: string | null | undefined;
};

export function useDashboardStats({ companyId }: UseDashboardStatsOptions) {
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

  return {
    dashboard: overviewQuery.data ?? EMPTY_DASHBOARD,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    error: overviewQuery.error,
    hasData: overviewQuery.data !== undefined,
    dataUpdatedAt: overviewQuery.dataUpdatedAt,
    refetch: overviewQuery.refetch,
  };
}
