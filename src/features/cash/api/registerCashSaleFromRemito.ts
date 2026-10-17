import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethod } from "../types";

export async function registerCashSaleFromRemito(params: {
  companyId: string;
  documentId: string;
  paymentMethod: PaymentMethod;
  externalInvoiceNumber?: string;
}) {
  const { data, error } = await supabase.rpc("register_cash_sale_from_remito_with_invoice", {
    p_company_id: params.companyId,
    p_document_id: params.documentId,
    p_payment_method: params.paymentMethod,
    p_external_invoice_number: params.externalInvoiceNumber?.trim() || null,
  });

  if (error) throw error;
  return data;
}
