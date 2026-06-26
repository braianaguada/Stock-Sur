import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildAccountStatement, type AccountStatementFilters, type AccountStatementSource } from "@/features/customer-account/lib/accountStatement";

type RawAccountEntry = {
  id: string;
  company_id: string;
  customer_id: string;
  entry_type: "DEBIT" | "CREDIT";
  origin_type: "DOCUMENT" | "CASH_SALE" | "MANUAL";
  origin_id: string;
  document_id: string | null;
  cash_sale_id: string | null;
  amount: number;
  business_date: string;
  description: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  customers: { name: string | null; is_occasional: boolean | null; account_due_days: number | null } | null;
  documents: {
    id: string;
    doc_type: string | null;
    point_of_sale: number | null;
    document_number: number | null;
    external_invoice_number: string | null;
    issue_date: string | null;
  } | null;
  cash_sales: {
    id: string;
    receipt_kind: string | null;
    receipt_reference: string | null;
    business_date: string | null;
  } | null;
};

function normalizeEntry(entry: RawAccountEntry): AccountStatementSource {
  return {
    id: entry.id,
    company_id: entry.company_id,
    customer_id: entry.customer_id,
    customer_name: entry.customers?.name ?? null,
    customer_is_occasional: entry.customers?.is_occasional ?? null,
    customer_account_due_days: entry.customers?.account_due_days ?? 30,
    entry_type: entry.entry_type,
    origin_type: entry.origin_type,
    origin_id: entry.origin_id,
    document_id: entry.document_id,
    cash_sale_id: entry.cash_sale_id,
    amount: Number(entry.amount),
    business_date: entry.business_date,
    description: entry.description,
    notes: entry.notes,
    metadata: entry.metadata,
    document: entry.documents,
    cashSale: entry.cash_sales,
  };
}

export function useCustomerAccountStatement(companyId: string | null | undefined, filters: AccountStatementFilters) {
  return useQuery({
    queryKey: queryKeys.customers.accountStatement(companyId ?? null, filters),
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_account_entries")
        .select(`
          id,
          company_id,
          customer_id,
          entry_type,
          origin_type,
          origin_id,
          document_id,
          cash_sale_id,
          amount,
          business_date,
          description,
          notes,
          metadata,
          customers!inner(name, is_occasional, account_due_days),
          documents(id, doc_type, point_of_sale, document_number, external_invoice_number, issue_date),
          cash_sales(id, receipt_kind, receipt_reference, business_date)
        `)
        .eq("company_id", companyId!)
        .eq("customers.is_occasional", false)
        .order("business_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      const entries = (data ?? []).map((row) => normalizeEntry(row as unknown as RawAccountEntry));
      const invoiceReferences = Array.from(new Set(
        entries
          .filter((entry) => !entry.document_id)
          .map((entry) => {
            const metadata = entry.metadata ?? {};
            const value = metadata.reference_number ?? metadata.reference ?? metadata.receipt_reference ?? entry.cashSale?.receipt_reference;
            return typeof value === "string" ? value.trim() : "";
          })
          .filter(Boolean),
      ));

      if (invoiceReferences.length === 0) return entries;

      const { data: linkedDocuments, error: linkedDocumentsError } = await supabase
        .from("documents")
        .select("id, doc_type, point_of_sale, document_number, external_invoice_number, issue_date")
        .eq("company_id", companyId!)
        .eq("external_invoice_status", "ACTIVE")
        .in("external_invoice_number", invoiceReferences);
      if (linkedDocumentsError) throw linkedDocumentsError;

      const documentByInvoice = new Map(
        (linkedDocuments ?? [])
          .filter((document) => document.external_invoice_number)
          .map((document) => [document.external_invoice_number!.trim(), document]),
      );

      return entries.map((entry) => {
        if (entry.document_id) return entry;
        const metadata = entry.metadata ?? {};
        const rawReference = metadata.reference_number ?? metadata.reference ?? metadata.receipt_reference ?? entry.cashSale?.receipt_reference;
        const reference = typeof rawReference === "string" ? rawReference.trim() : "";
        const document = documentByInvoice.get(reference);
        return document ? { ...entry, document_id: document.id, document } : entry;
      });
    },
    select: (entries) => buildAccountStatement(entries, filters),
  });
}
