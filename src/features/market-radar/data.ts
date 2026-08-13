import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllPages } from "@/lib/supabase-pagination";
import type { ItemSample, MovementSample } from "@/features/market-radar/trends";

export type MarketSignal = Database["public"]["Tables"]["market_watch_signals"]["Row"];
export type MarketSignalInsert = Database["public"]["Tables"]["market_watch_signals"]["Insert"];

export async function fetchMarketItems(companyId: string): Promise<ItemSample[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id,name,sku,unit")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data ?? []) as ItemSample[];
}

export async function fetchMarketMovements(companyId: string): Promise<MovementSample[]> {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  return fetchAllPages<MovementSample>(() => supabase
    .from("stock_movements")
    .select("item_id,quantity,created_at")
    .eq("company_id", companyId)
    .eq("type", "OUT")
    .gte("created_at", since)
    .order("created_at", { ascending: false }));
}

export async function fetchMarketSignals(companyId: string): Promise<MarketSignal[]> {
  const { data, error } = await supabase
    .from("market_watch_signals")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("observed_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createMarketSignal(signal: MarketSignalInsert): Promise<void> {
  const { error } = await supabase.from("market_watch_signals").insert(signal);
  if (error) throw error;
}

export async function archiveMarketSignal(companyId: string, signalId: string): Promise<void> {
  const { error } = await supabase
    .from("market_watch_signals")
    .update({ is_active: false })
    .eq("id", signalId)
    .eq("company_id", companyId);

  if (error) throw error;
}
