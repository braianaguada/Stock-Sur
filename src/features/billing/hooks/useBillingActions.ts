import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { BillingDocumentRow, BillingInvoiceType } from "../types";

type SupabaseRpcResult = { data: unknown; error: Error | null };
const billingRpc = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult>;
};

type UseBillingActionsParams = {
  companyId: string | null;
  businessDate?: string;
};

export function useBillingActions({ companyId, businessDate }: UseBillingActionsParams) {
  const queryClient = useQueryClient();

  const createBillingDraftMutation = useMutation({
    mutationFn: async ({ cashSaleId, invoiceType }: { cashSaleId: string; invoiceType: BillingInvoiceType }) => {
      const { data, error } = await billingRpc.rpc("create_billing_draft_from_cash_sale", {
        p_cash_sale_id: cashSaleId,
        p_invoice_type: invoiceType,
      });

      if (error) throw error;
      return data as BillingDocumentRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.documents(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.activeSourceIds(companyId) });
      if (businessDate) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cash.sales(companyId, businessDate) });
      }
    },
  });

  return { createBillingDraftMutation };
}
