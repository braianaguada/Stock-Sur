import { useQuery } from "@tanstack/react-query";
import { EMPTY_DASHBOARD, normalizeDashboardInsights } from "@/features/index/dashboard-insights";
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
      const { data, error } = await supabase.rpc("get_dashboard_operational_overview", {
        p_company_id: companyId!,
      });

      if (error) throw error;
      return normalizeDashboardInsights(data);
    },
  });

  return {
    dashboard: overviewQuery.data ?? EMPTY_DASHBOARD,
    isLoading: overviewQuery.isLoading,
    isFetching: overviewQuery.isFetching,
    error: overviewQuery.error,
  };
}
