import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCustomerAccountSummary(companyId: string | null, customerId: string | null) {
  return useQuery({
    queryKey: ["customer-account-summary", companyId ?? "no-company", customerId ?? "no-customer"],
    enabled: Boolean(companyId && customerId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_account_summary", {
        p_company_id: companyId!,
        p_customer_id: customerId!,
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] ?? null : data ?? null;
    },
  });
}
