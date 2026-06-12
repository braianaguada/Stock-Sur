import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import type { BillingDocumentRow } from "@/features/billing/types";
import type { CashSaleRow, RemitoOption } from "@/features/cash/types";
import { buildOccasionalOperations } from "./operations";

type QueryBuilderResult<T> = { data: T[] | null; error: Error | null };
type OccasionalQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        is: (column: string, value: null) => {
          in: (column: string, values: unknown[]) => {
            gte: (column: string, value: string) => {
              lte: (column: string, value: string) => {
                order: (column: string, options: { ascending: boolean }) => {
                  limit: (count: number) => Promise<QueryBuilderResult<unknown>>;
                };
              };
            };
          };
        };
        gte: (column: string, value: string) => {
          lte: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => {
              limit: (count: number) => Promise<QueryBuilderResult<unknown>>;
            };
          };
        };
        in: (column: string, values: unknown[]) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => Promise<QueryBuilderResult<unknown>>;
          };
        };
      };
    };
  };
};

const occasionalDb = supabase as unknown as OccasionalQueryClient;

export function useOccasionalCustomerOperations(companyId: string | null, from: string, to: string) {
  const query = useQuery({
    queryKey: queryKeys.customers.occasionalOperations(companyId, from, to),
    enabled: Boolean(companyId && from && to),
    queryFn: async () => {
      if (!companyId) return { remitos: [], sales: [], billingDocuments: [] };

      const [remitosResult, salesResult, billingResult] = await Promise.all([
        occasionalDb
          .from("documents")
          .select("id, doc_type, customer_id, customer_name, point_of_sale, document_number, issue_date, created_at, status, total, origin_document_id, source_document_number_snapshot, technician_id, external_invoice_number, external_invoice_status")
          .eq("company_id", companyId)
          .is("customer_id", null)
          .in("doc_type", ["REMITO", "REMITO_DEVOLUCION"])
          .gte("issue_date", from)
          .lte("issue_date", to)
          .order("issue_date", { ascending: false })
          .limit(1000),
        occasionalDb
          .from("cash_sales")
          .select("id, sold_at, business_date, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
          .eq("company_id", companyId)
          .gte("business_date", from)
          .lte("business_date", to)
          .order("sold_at", { ascending: false })
          .limit(1000),
        occasionalDb
          .from("billing_documents")
          .select("id, company_id, source_type, source_id, source_remito_id, related_billing_document_id, document_kind, invoice_type, fiscal_status, provider, environment, issuer_tax_id, issuer_name, issuer_tax_condition, receiver_name, receiver_doc_type, receiver_doc_number, receiver_tax_condition, receiver_fiscal_snapshot, currency, currency_rate, subtotal, discount_total, tax_total, total, point_of_sale, voucher_number, voucher_full_number, voucher_date, cae, cae_expires_at, authorized_at, authorized_by, provider_errors, provider_observations, error_message, created_at, updated_at")
          .eq("company_id", companyId)
          .in("invoice_type", ["FACTURA_B", "NOTA_CREDITO_B"])
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      if (remitosResult.error) throw remitosResult.error;
      if (salesResult.error) throw salesResult.error;
      if (billingResult.error) throw billingResult.error;

      return {
        remitos: (remitosResult.data ?? []) as RemitoOption[],
        sales: (salesResult.data ?? []) as CashSaleRow[],
        billingDocuments: (billingResult.data ?? []) as BillingDocumentRow[],
      };
    },
  });

  const operations = useMemo(
    () => buildOccasionalOperations({
      remitos: query.data?.remitos ?? [],
      sales: query.data?.sales ?? [],
      billingDocuments: query.data?.billingDocuments ?? [],
    }),
    [query.data?.billingDocuments, query.data?.remitos, query.data?.sales],
  );

  return {
    ...query,
    operations,
    remitos: query.data?.remitos ?? [],
    sales: query.data?.sales ?? [],
    billingDocuments: query.data?.billingDocuments ?? [],
  };
}
