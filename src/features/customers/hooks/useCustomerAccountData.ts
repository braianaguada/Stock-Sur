import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export type CustomerAccountSummary = {
  company_id: string;
  customer_id: string;
  balance: number;
  movements_count: number;
  last_movement_at: string | null;
  last_entry_type: "DEBIT" | "CREDIT" | null;
  last_origin_type: "DOCUMENT" | "CASH_SALE" | "MANUAL" | null;
  last_description: string | null;
  last_amount: number | null;
};

export type CustomerAccountEntry = {
  id: string;
  business_date: string;
  created_at: string;
  entry_type: "DEBIT" | "CREDIT";
  origin_type: "DOCUMENT" | "CASH_SALE" | "MANUAL";
  amount: number;
  description: string | null;
  notes: string | null;
  document_id: string | null;
  cash_sale_id: string | null;
  metadata: Record<string, unknown> | null;
};

export function useCustomerAccountData(companyId: string | null | undefined, customerId: string | null | undefined) {
  const summaryQuery = useQuery({
    queryKey: queryKeys.customers.accountSummary(companyId ?? null, customerId ?? null),
    enabled: Boolean(companyId && customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_account_summary")
        .select("*")
        .eq("company_id", companyId!)
        .eq("customer_id", customerId!)
        .maybeSingle();
      if (error) throw error;
      return data as CustomerAccountSummary | null;
    },
  });

  const entriesQuery = useQuery({
    queryKey: queryKeys.customers.accountEntries(companyId ?? null, customerId ?? null),
    enabled: Boolean(companyId && customerId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_customer_account_entries", {
        p_company_id: companyId!,
        p_customer_id: customerId!,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as CustomerAccountEntry[];
    },
  });

  return {
    summary: summaryQuery.data ?? null,
    entries: entriesQuery.data ?? [],
    isLoading: summaryQuery.isLoading || entriesQuery.isLoading,
    refetch: async () => {
      await Promise.all([summaryQuery.refetch(), entriesQuery.refetch()]);
    },
  };
}
