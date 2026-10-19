import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { fetchAllPages } from "@/lib/supabase-pagination";

export function useCustomerAccountCustomers(companyId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.list(companyId ?? null, "account-statement"),
    enabled: Boolean(companyId),
    queryFn: async () => {
      return fetchAllPages(() => ({ range: async (from, to) => await supabase
        .from("customers")
        .select("id, name, account_due_days")
        .eq("company_id", companyId!)
        .eq("is_occasional", false)
        .order("name").order("id").range(from, to) }));
    },
  });
}
