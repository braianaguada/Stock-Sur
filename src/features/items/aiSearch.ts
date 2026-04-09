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

function tokenize(value: string) {
  return normalizeText(value).split(" ").filter(Boolean);
}

function compactToken(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function buildBigrams(value: string) {
  if (value.length < 2) return new Set<string>(value ? [value] : []);
  const bigrams = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    bigrams.add(value.slice(index, index + 2));
  }
  return bigrams;
}

function diceCoefficient(left: string, right: string) {
  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;

  let matches = 0;
  leftBigrams.forEach((bigram) => {
    if (rightBigrams.has(bigram)) matches += 1;
  });

  return (2 * matches) / (leftBigrams.size + rightBigrams.size);
}

function fuzzyTokenScore(queryToken: string, candidateTokens: string[]) {
  const compactQuery = compactToken(queryToken);
  if (compactQuery.length < 3) return 0;

  let best = 0;
  candidateTokens.forEach((candidateToken) => {
    const compactCandidate = compactToken(candidateToken);
    if (!compactCandidate) return;

    if (compactCandidate.includes(compactQuery) || compactQuery.includes(compactCandidate)) {
      best = Math.max(best, 24);
      return;
    }

    if (
      compactQuery.length >= 4 &&
      compactCandidate.length >= 5 &&
      compactQuery.slice(0, 2) === compactCandidate.slice(0, 2)
    ) {
      best = Math.max(best, 18);
    }

    const distance = levenshteinDistance(compactQuery, compactCandidate);
    const maxLength = Math.max(compactQuery.length, compactCandidate.length);
    if (distance <= 1 && maxLength >= 4) {
      best = Math.max(best, 20);
      return;
    }

    if (distance <= 2 && maxLength >= 6) {
      best = Math.max(best, 14);
      return;
    }

    const dice = diceCoefficient(compactQuery, compactCandidate);
    if (dice >= 0.45) {
      best = Math.max(best, 16);
    }
  });

  return best;
}

export function buildItemAiSearchCandidates(params: {
  items: Item[];
  aliases: ItemSearchAliasRecord[];
  query: string;
}) {
  const query = normalizeText(params.query);
  const queryTokens = tokenize(params.query);
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
      const haystackTokens = tokenize(haystack);

      const exact = haystack.includes(query);
      const matchedTokens = queryTokens.filter((token) => token.length >= 2 && haystack.includes(token)).length;
      const fuzzyScore = queryTokens.reduce((sum, token) => sum + fuzzyTokenScore(token, haystackTokens), 0);
      const score = (exact ? 100 : 0) + matchedTokens * 12 + fuzzyScore;

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
    .filter((candidate) => candidate.score >= (queryTokens.length <= 1 ? 16 : 24))
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

  const candidates = buildItemAiSearchCandidates(params);
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
