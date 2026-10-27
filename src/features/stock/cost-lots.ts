import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const lotSchema = z.object({
  id: z.string(),
  acquired_at: z.string(),
  kind: z.enum(["PURCHASE", "UNVALUED", "OPENING", "SHORTAGE"]),
  supplier: z.string().nullable(),
  unit_cost_ars: z.number().finite().nonnegative().nullable(),
  received_quantity: z.number().finite(),
  remaining_quantity: z.number().finite(),
  remaining_value_ars: z.number().finite().nullable(),
});

export type StockCostLot = z.infer<typeof lotSchema>;

export async function fetchStockCostLots(companyId: string, itemId: string) {
  const { data, error } = await supabase.rpc("list_stock_cost_lots", {
    p_company_id: companyId, p_item_id: itemId,
  });
  if (error) throw new Error(error.message);
  return z.array(lotSchema).parse(data);
}

export function summarizeStockCostLots(lots: StockCostLot[]) {
  return lots.reduce((total, lot) => ({
    knownValue: total.knownValue + (lot.remaining_value_ars ?? 0),
    unvaluedQuantity: total.unvaluedQuantity + (lot.unit_cost_ars === null ? Math.max(0, lot.remaining_quantity) : 0),
    shortageQuantity: total.shortageQuantity + Math.max(0, -lot.remaining_quantity),
  }), { knownValue: 0, unvaluedQuantity: 0, shortageQuantity: 0 });
}
