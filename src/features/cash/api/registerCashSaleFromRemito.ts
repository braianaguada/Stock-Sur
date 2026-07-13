import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethod } from "../types";

export async function registerCashSaleFromRemito(params: {
  companyId: string;
  documentId: string;
  paymentMethod: PaymentMethod;
}) {
  const { data, error } = await supabase.rpc("register_cash_sale_from_remito", {
    p_company_id: params.companyId,
    p_document_id: params.documentId,
    p_payment_method: params.paymentMethod,
  });

  if (error) throw error;
  return data;
}
