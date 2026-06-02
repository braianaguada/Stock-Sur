import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildDisableBillingSettingsPayload, buildEnableBillingSettingsPayload } from "../lib/settings";
import type { BillingDocumentRow, BillingInvoiceType } from "../types";

type SupabaseRpcResult = { data: unknown; error: Error | null };
type SupabaseWriteResult = { data: unknown; error: Error | null };
type SupabaseWriteBuilder = PromiseLike<SupabaseWriteResult> & {
  eq: (column: string, value: unknown) => SupabaseWriteBuilder;
  select: (columns: string) => SupabaseWriteBuilder;
  single: () => Promise<SupabaseWriteResult>;
};
const billingRpc = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult>;
  from: (table: string) => {
    update: (values: Record<string, unknown>) => SupabaseWriteBuilder;
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => SupabaseWriteBuilder;
  };
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

  const enableBillingMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No hay empresa activa para activar facturacion interna.");

      const { data, error } = await billingRpc
        .from("billing_settings")
        .upsert(
          buildEnableBillingSettingsPayload(companyId),
          { onConflict: "company_id,provider,environment" },
        )
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
    },
  });

  const disableBillingMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No hay empresa activa para desactivar facturacion interna.");

      const { data, error } = await billingRpc
        .from("billing_settings")
        .update(buildDisableBillingSettingsPayload())
        .eq("company_id", companyId)
        .eq("provider", "AFIPSDK")
        .eq("environment", "dev")
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.activeSourceIds(companyId) });
    },
  });

  return { createBillingDraftMutation, enableBillingMutation, disableBillingMutation };
}
