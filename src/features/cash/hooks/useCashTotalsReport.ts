import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { buildCashTotalsReport } from "@/features/cash/lib/cashTotals";
import { fetchAllCashRows } from "@/features/cash/lib/fetchAllCashRows";
import type { CashAdjustmentRow, CashExpenseRow, CashSaleRow } from "@/features/cash/types";

async function fetchCashTotalsReport(companyId: string, fromDate: string, toDate: string) {
  const [sales, expenses, adjustments] = await Promise.all([
    fetchAllCashRows<CashSaleRow>((from, to) => supabase
      .from("cash_sales")
      .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes", { count: "exact" })
      .eq("company_id", companyId)
      .gte("business_date", fromDate)
      .lte("business_date", toDate)
      .order("business_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)),
    fetchAllCashRows<CashExpenseRow>((from, to) => supabase
      .from("cash_expenses")
      .select("id, company_id, business_date, spent_at, expense_kind, category, amount_total, description, has_receipt, receipt_reference, notes, closure_id, created_by, created_at, updated_at, cancelled_at, cancelled_by", { count: "exact" })
      .eq("company_id", companyId)
      .gte("business_date", fromDate)
      .lte("business_date", toDate)
      .order("business_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)),
    fetchAllCashRows<CashAdjustmentRow>((from, to) => supabase
      .from("cash_adjustments")
      .select("id, company_id, business_date, occurred_at, document_id, adjustment_kind, payment_method, amount_total, signed_amount, customer_id, customer_name_snapshot, closure_id, notes, cancelled_at, cancelled_by, created_by, created_at, updated_at", { count: "exact" })
      .eq("company_id", companyId)
      .gte("business_date", fromDate)
      .lte("business_date", toDate)
      .order("business_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)),
  ]);

  return buildCashTotalsReport(sales, expenses, adjustments);
}

export function useCashTotalsReport(
  companyId: string | null | undefined,
  fromDate: string,
  toDate: string,
) {
  return useQuery({
    queryKey: queryKeys.cash.totals(companyId ?? null, fromDate, toDate),
    enabled: Boolean(companyId),
    queryFn: () => fetchCashTotalsReport(companyId!, fromDate, toDate),
  });
}
