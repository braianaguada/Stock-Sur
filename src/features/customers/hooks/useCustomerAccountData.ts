import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerAccountEntry, CustomerAccountSummary } from "@/features/customers/types";

export function useCustomerAccountData(companyId: string | null | undefined, customerId: string | null) {
  const summaryQuery = useQuery({
    queryKey: ["customer-account-summary", companyId ?? "no-company", customerId ?? "no-customer"],
    enabled: Boolean(companyId && customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_account_summary")
        .select("*")
        .eq("company_id", companyId!)
        .eq("customer_id", customerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CustomerAccountSummary | null;
    },
  });

  const movementsQuery = useQuery({
    queryKey: ["customer-account-movements", companyId ?? "no-company", customerId ?? "no-customer"],
    enabled: Boolean(companyId && customerId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_customer_account_entries", {
        p_company_id: companyId!,
        p_customer_id: customerId!,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as CustomerAccountEntry[];
    },
  });

  return {
    summary: summaryQuery.data ?? null,
    movements: movementsQuery.data ?? [],
    isLoading: summaryQuery.isLoading || movementsQuery.isLoading,
  };
}
