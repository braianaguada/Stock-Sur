import { supabase } from "@/integrations/supabase/client";

type DeleteMode = "soft" | "hard";

interface DeleteOptions {
  table: "suppliers" | "items" | "price_list_items" | "customers" | "price_lists" | "item_aliases" | "quotes";
  idColumn?: string;
  id: string;
  eq?: Record<string, string>;
}

const TABLE_DELETE_MODE: Record<DeleteOptions["table"], DeleteMode> = {
  suppliers: "soft",
  items: "soft",
  price_list_items: "soft",
  customers: "hard",
  price_lists: "hard",
  item_aliases: "hard",
  quotes: "hard",
};

export async function deleteByStrategy({ table, id, idColumn = "id", eq = {} }: DeleteOptions) {
  const mode = TABLE_DELETE_MODE[table];

  if (mode === "soft") {
    let query = supabase.from(table).update({ is_active: false }).eq(idColumn, id);
    for (const [column, value] of Object.entries(eq)) {
      query = query.eq(column, value);
    }
    const { error } = await query;
    if (error) throw error;
    return { mode };
  }

  let query = supabase.from(table).delete().eq(idColumn, id);
  for (const [column, value] of Object.entries(eq)) {
    query = query.eq(column, value);
  }
  const { error } = await query;
  if (error) throw error;
  return { mode };
}
