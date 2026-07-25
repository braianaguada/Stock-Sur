import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export function useCustomerAccountCustomers(companyId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.list(companyId ?? null, "account-statement"),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId!)
        .eq("is_occasional", false)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });
}
