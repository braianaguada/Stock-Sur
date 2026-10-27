import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchStockCostLots } from "../cost-lots";

export function useStockCostLots(companyId: string, itemId: string) {
  return useQuery({
    queryKey: queryKeys.stock.costLots(companyId, itemId),
    queryFn: () => fetchStockCostLots(companyId, itemId),
    enabled: Boolean(companyId && itemId),
  });
}
