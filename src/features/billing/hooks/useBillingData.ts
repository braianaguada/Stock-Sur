import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { BillingDiagnosticsResult, BillingDocumentLineRow, BillingDocumentRow, BillingPointOfSaleRow, BillingRemitoReference, BillingSettingsRow } from "../types";

type SupabaseQueryResult = { data: unknown; error: Error | null };
type SupabaseQueryBuilder = PromiseLike<SupabaseQueryResult> & {
  select: (columns: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  neq: (column: string, value: unknown) => SupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
};
const billingDb = supabase as unknown as {
  from: (table: string) => SupabaseQueryBuilder;
};

export function useBillingSettings(companyId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.billing.settings(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_settings")
        .select("id, company_id, provider, environment, is_enabled, default_currency, default_concept, credentials_status, issuer_tax_id, issuer_name, issuer_tax_condition, notes")
        .eq("company_id", companyId!)
        .eq("provider", "AFIPSDK")
        .order("environment", { ascending: true });

      if (error) throw error;
      return ((data as BillingSettingsRow[] | null) ?? []);
    },
  });

  const billingEnabled = useMemo(
    () => (query.data ?? []).some((setting) => setting.is_enabled),
    [query.data],
  );

  return { ...query, settings: query.data ?? [], billingEnabled };
}

export function useBillingDiagnostics(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.billing.diagnostics(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("billing-diagnostics", {
        body: { companyId },
      });

      if (error) throw error;
      return data as BillingDiagnosticsResult;
    },
    staleTime: 30_000,
  });
}

export function useBillingPointsOfSale(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.billing.pointsOfSale(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_points_of_sale")
        .select("id, company_id, billing_settings_id, point_of_sale, description, is_enabled, created_at, updated_at")
        .eq("company_id", companyId!)
        .order("point_of_sale", { ascending: true });

      if (error) throw error;
      return ((data as BillingPointOfSaleRow[] | null) ?? []);
    },
  });
}

export function useBillingDocuments(companyId: string | null) {
  return useQuery({
    queryKey: queryKeys.billing.documents(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_documents")
        .select("id, company_id, source_type, source_id, source_remito_id, related_billing_document_id, document_kind, invoice_type, fiscal_status, provider, environment, issuer_tax_id, issuer_name, issuer_tax_condition, receiver_name, receiver_doc_type, receiver_doc_number, receiver_tax_condition, currency, currency_rate, subtotal, discount_total, tax_total, total, point_of_sale, voucher_number, voucher_full_number, voucher_date, cae, cae_expires_at, authorized_at, authorized_by, provider_errors, provider_observations, error_message, created_at, updated_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return ((data as BillingDocumentRow[] | null) ?? []);
    },
  });
}

export function useBillingDocumentLines(documentId: string | null) {
  return useQuery({
    queryKey: queryKeys.billing.lines(documentId),
    enabled: Boolean(documentId),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_document_lines")
        .select("id, billing_document_id, source_document_line_id, line_order, description, unit, quantity, unit_price, discount_pct, discount_total, vat_rate, net_amount, vat_amount, total")
        .eq("billing_document_id", documentId!)
        .order("line_order", { ascending: true });

      if (error) throw error;
      return ((data as BillingDocumentLineRow[] | null) ?? []);
    },
  });
}

export function useActiveBillingSourceIds(companyId: string | null) {
  const query = useQuery({
    queryKey: queryKeys.billing.activeSourceIds(companyId),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("billing_documents")
        .select("source_id")
        .eq("company_id", companyId!)
        .eq("source_type", "CASH_SALE_FROM_REMITO")
        .eq("document_kind", "INVOICE")
        .neq("fiscal_status", "CANCELLED_INTERNAL")
        .limit(5000);

      if (error) throw error;
      const rows = (data as Array<{ source_id: string }> | null) ?? [];
      return new Set(rows.map((row) => row.source_id));
    },
  });

  return { ...query, billedSourceIds: query.data ?? new Set<string>() };
}

export function useBillingRemitoReferences(companyId: string | null, remitoIds: string[]) {
  const stableIds = useMemo(() => [...new Set(remitoIds)].sort(), [remitoIds]);

  return useQuery({
    queryKey: queryKeys.billing.remitos(companyId, stableIds.join(",")),
    enabled: Boolean(companyId) && stableIds.length > 0,
    queryFn: async () => {
      const { data, error } = await billingDb
        .from("documents")
        .select("id, point_of_sale, document_number, customer_name")
        .eq("company_id", companyId!)
        .in("id", stableIds);

      if (error) throw error;
      const rows = (data as BillingRemitoReference[] | null) ?? [];
      return new Map(rows.map((row) => [row.id, row]));
    },
  });
}
