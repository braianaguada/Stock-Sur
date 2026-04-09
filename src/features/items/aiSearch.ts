import { supabase } from "@/integrations/supabase/client";
import type { Item } from "@/features/items/types";
import type { ItemSearchAliasRecord } from "@/features/items/search";

type ItemSearchAiCandidate = {
  itemId: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  aliases: string[];
};

type ItemSearchAiResponse = {
  matchedItemIds?: string[];
  meta?: {
    model?: string;
  };
};

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/+\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCandidates(params: {
  items: Item[];
  aliases: ItemSearchAliasRecord[];
  query: string;
}) {
  const query = normalizeText(params.query);
  const queryTokens = query.split(" ").filter(Boolean);
  const aliasesByItemId = new Map<string, string[]>();

  params.aliases.forEach((alias) => {
    if (!aliasesByItemId.has(alias.item_id)) aliasesByItemId.set(alias.item_id, []);
    aliasesByItemId.get(alias.item_id)!.push(alias.alias);
  });

  return params.items
    .map((item) => {
      const aliases = aliasesByItemId.get(item.id) ?? [];
      const haystack = normalizeText([
        item.sku,
        item.name,
        item.brand ?? "",
        item.model ?? "",
        item.category ?? "",
        ...aliases,
      ].join(" "));

      const exact = haystack.includes(query);
      const matchedTokens = queryTokens.filter((token) => token.length >= 2 && haystack.includes(token)).length;
      const score = (exact ? 100 : 0) + matchedTokens * 10;

      return {
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        brand: item.brand,
        model: item.model,
        category: item.category,
        aliases: aliases.slice(0, 6),
        score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, 60)
    .map(({ score: _score, ...candidate }) => candidate satisfies ItemSearchAiCandidate);
}

export async function fetchItemAiSearch(params: {
  query: string;
  items: Item[];
  aliases: ItemSearchAliasRecord[];
}) {
  const query = params.query.trim();
  if (query.length < 2) return null;

  const candidates = buildCandidates(params);
  if (candidates.length === 0) return null;

  const { data, error } = await supabase.functions.invoke("item-search-ai", {
    body: {
      query,
      candidates,
    },
  });

  if (error) throw error;

  const payload = (data ?? {}) as ItemSearchAiResponse;
  const matchedItemIds = Array.isArray(payload.matchedItemIds)
    ? payload.matchedItemIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (matchedItemIds.length === 0) return null;

  const itemsById = new Map(params.items.map((item) => [item.id, item]));
  const ranked = matchedItemIds
    .map((itemId) => itemsById.get(itemId))
    .filter((item): item is Item => item !== undefined);

  return {
    items: ranked,
    model: payload.meta?.model ?? null,
  };
}
