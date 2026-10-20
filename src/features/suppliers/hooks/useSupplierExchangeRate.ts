import { useQuery } from "@tanstack/react-query";
import { fetchBnaOfficialUsdRate } from "@/features/services/exchangeRateProvider";

export function useSupplierExchangeRate(companyId?: string) {
  return useQuery({ queryKey: ["supplier-bna-rate", companyId], queryFn: fetchBnaOfficialUsdRate, enabled: Boolean(companyId), staleTime: 300000, retry: 1 });
}
