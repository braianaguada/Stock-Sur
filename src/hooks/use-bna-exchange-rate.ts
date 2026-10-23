import { useQuery } from "@tanstack/react-query";
import { fetchBnaOfficialUsdRate } from "@/features/services/exchangeRateProvider";

export function useBnaExchangeRate(companyId?: string) {
  return useQuery({
    queryKey: ["bna-usd-rate", companyId],
    queryFn: fetchBnaOfficialUsdRate,
    enabled: Boolean(companyId),
    staleTime: 300000,
    refetchInterval: 300000,
    retry: 1,
  });
}
