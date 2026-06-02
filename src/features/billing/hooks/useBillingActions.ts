import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildDisableBillingSettingsPayload, buildEnableBillingSettingsPayload } from "../lib/settings";
import type { BillingDocumentRow, BillingInvoiceType } from "../types";

type SupabaseRpcResult = { data: unknown; error: Error | null };
type SupabaseWriteResult = { data: unknown; error: Error | null };
type SupabaseWriteBuilder = PromiseLike<SupabaseWriteResult> & {
  eq: (column: string, value: unknown) => SupabaseWriteBuilder;
  limit: (count: number) => SupabaseWriteBuilder;
  select: (columns: string) => SupabaseWriteBuilder;
  single: () => Promise<SupabaseWriteResult>;
};
const billingRpc = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<SupabaseRpcResult>;
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => SupabaseWriteBuilder;
    update: (values: Record<string, unknown>) => SupabaseWriteBuilder;
    select: (columns: string) => SupabaseWriteBuilder;
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

      const existingSettings = await billingRpc
        .from("billing_settings")
        .select("id")
        .eq("company_id", companyId)
        .eq("provider", "AFIPSDK")
        .eq("environment", "dev")
        .limit(1);

      if (existingSettings.error) throw existingSettings.error;

      const existingId = ((existingSettings.data as Array<{ id: string }> | null) ?? [])[0]?.id;
      const write = existingId
        ? billingRpc
          .from("billing_settings")
          .update(buildEnableBillingSettingsPayload(companyId))
          .eq("id", existingId)
        : billingRpc
          .from("billing_settings")
          .insert(buildEnableBillingSettingsPayload(companyId));

      const { data, error } = await write
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

  const authorizeBillingDocumentMutation = useMutation({
    mutationFn: async ({ billingDocumentId }: { billingDocumentId: string }) => {
      const { data, error } = await supabase.functions.invoke("billing-authorize-document", {
        body: { billingDocumentId },
      });

      if (error) throw error;
      return data as { document: BillingDocumentRow };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.documents(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
    },
  });

  return { createBillingDraftMutation, enableBillingMutation, disableBillingMutation, authorizeBillingDocumentMutation };
}
