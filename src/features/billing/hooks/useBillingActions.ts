import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { isValidCuitFormat, normalizeCuit } from "../lib/cuit";
import { buildDisableBillingSettingsPayload, buildEnableBillingSettingsPayload } from "../lib/settings";
import type { BillingDocumentRow, BillingInvoiceType, BillingSettingsRow } from "../types";

type SupabaseRpcResult = { data: unknown; error: Error | null };
type SupabaseWriteResult = { data: unknown; error: Error | null };
type SupabaseWriteBuilder = PromiseLike<SupabaseWriteResult> & {
  eq: (column: string, value: unknown) => SupabaseWriteBuilder;
  in: (column: string, values: unknown[]) => SupabaseWriteBuilder;
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

type BillingSettingsFormInput = {
  isEnabled: boolean;
  issuerTaxId: string;
  issuerName: string;
  issuerTaxCondition: string;
  notes: string;
};

type BillingPointOfSaleCreateInput = {
  pointOfSale: number;
  description: string;
  isEnabled: boolean;
};

type BillingPointOfSaleUpdateInput = {
  id: string;
  description: string;
  isEnabled: boolean;
};

type UseBillingActionsParams = {
  companyId: string | null;
  businessDate?: string;
};

async function resolveFunctionError(error: Error) {
  const context = "context" in error ? error.context : null;
  const response = context instanceof Response ? context : null;

  if (response) {
    try {
      const payload = await response.clone().json();
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : "";

      if (message.trim()) return new Error(message);
    } catch {
      // Fall back to the generic Supabase error message below.
    }
  }

  return error;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function useBillingActions({ companyId, businessDate }: UseBillingActionsParams) {
  const queryClient = useQueryClient();

  const ensureDevBillingSettings = async (isEnabled = false) => {
    if (!companyId) throw new Error("No hay empresa activa para configurar facturacion.");

    const existingSettings = await billingRpc
      .from("billing_settings")
      .select("id")
      .eq("company_id", companyId)
      .eq("provider", "AFIPSDK")
      .eq("environment", "dev")
      .limit(1);

    if (existingSettings.error) throw existingSettings.error;

    const existingId = ((existingSettings.data as Array<{ id: string }> | null) ?? [])[0]?.id;
    if (existingId) return existingId;

    const { data, error } = await billingRpc
      .from("billing_settings")
      .insert({
        company_id: companyId,
        provider: "AFIPSDK",
        environment: "dev",
        default_currency: "ARS",
        default_concept: "PRODUCTS",
        credentials_status: "NOT_CONFIGURED",
        is_enabled: isEnabled,
      })
      .select("id")
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  };

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

  const saveBillingSettingsMutation = useMutation({
    mutationFn: async (input: BillingSettingsFormInput) => {
      if (!companyId) throw new Error("No hay empresa activa para guardar configuracion fiscal.");
      if (!isValidCuitFormat(input.issuerTaxId)) {
        throw new Error("El CUIT emisor debe tener 11 dígitos.");
      }

      const settingsId = await ensureDevBillingSettings(input.isEnabled);
      const { data, error } = await billingRpc
        .from("billing_settings")
        .update({
          is_enabled: input.isEnabled,
          issuer_tax_id: normalizeCuit(input.issuerTaxId),
          issuer_name: nullableText(input.issuerName),
          issuer_tax_condition: nullableText(input.issuerTaxCondition),
          notes: nullableText(input.notes),
        })
        .eq("id", settingsId)
        .select("id, company_id, provider, environment, is_enabled, default_currency, default_concept, credentials_status, issuer_tax_id, issuer_name, issuer_tax_condition, notes")
        .single();

      if (error) throw error;
      return data as BillingSettingsRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
    },
  });

  const createBillingPointOfSaleMutation = useMutation({
    mutationFn: async (input: BillingPointOfSaleCreateInput) => {
      if (!companyId) throw new Error("No hay empresa activa para crear punto de venta.");
      if (!Number.isInteger(input.pointOfSale) || input.pointOfSale <= 0) {
        throw new Error("El punto de venta debe ser un numero entero mayor a 0.");
      }

      const settingsId = await ensureDevBillingSettings(false);
      const { data, error } = await billingRpc
        .from("billing_points_of_sale")
        .insert({
          company_id: companyId,
          billing_settings_id: settingsId,
          point_of_sale: input.pointOfSale,
          description: nullableText(input.description),
          is_enabled: input.isEnabled,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.pointsOfSale(companyId) });
    },
  });

  const updateBillingPointOfSaleMutation = useMutation({
    mutationFn: async (input: BillingPointOfSaleUpdateInput) => {
      const { data, error } = await billingRpc
        .from("billing_points_of_sale")
        .update({
          description: nullableText(input.description),
          is_enabled: input.isEnabled,
        })
        .eq("id", input.id)
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.pointsOfSale(companyId) });
    },
  });

  const assignBillingDocumentPointOfSaleMutation = useMutation({
    mutationFn: async ({ billingDocumentId, pointOfSale }: { billingDocumentId: string; pointOfSale: number }) => {
      if (!Number.isInteger(pointOfSale) || pointOfSale <= 0) {
        throw new Error("Selecciona un punto de venta fiscal valido.");
      }

      const { data, error } = await billingRpc
        .from("billing_documents")
        .update({ point_of_sale: pointOfSale })
        .eq("id", billingDocumentId)
        .in("fiscal_status", ["DRAFT", "READY_TO_AUTHORIZE", "REJECTED"])
        .select("id, point_of_sale")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.documents(companyId) });
    },
  });

  const authorizeBillingDocumentMutation = useMutation({
    mutationFn: async ({ billingDocumentId }: { billingDocumentId: string }) => {
      const { data, error } = await supabase.functions.invoke("billing-authorize-document", {
        body: { billingDocumentId },
      });

      if (error) throw await resolveFunctionError(error);
      return data as { document: BillingDocumentRow };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.documents(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.settings(companyId) });
    },
  });

  return {
    createBillingDraftMutation,
    enableBillingMutation,
    disableBillingMutation,
    saveBillingSettingsMutation,
    createBillingPointOfSaleMutation,
    updateBillingPointOfSaleMutation,
    assignBillingDocumentPointOfSaleMutation,
    authorizeBillingDocumentMutation,
  };
}
