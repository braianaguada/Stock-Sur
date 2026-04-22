import type { Item } from "@/features/items/types";

export interface ItemSearchAliasRecord {
  item_id: string;
  alias: string;
  is_supplier_code: boolean;
}

const PHRASE_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\bmedia\b/g, "1/2"],
  [/\bmedio\b/g, "1/2"],
  [/\bmedia pulgada\b/g, "1/2"],
  [/\buna mitad\b/g, "1/2"],
  [/\btres cuartos\b/g, "3/4"],
  [/\bcuarto\b/g, "1/4"],
  [/\bun cuarto\b/g, "1/4"],
  [/\boctavo\b/g, "1/8"],
  [/\bcano\b/g, "cano"],
  [/\bcanos\b/g, "canos"],
  [/\baa\b/g, "aire acondicionado"],
  [/\bsplit\b/g, "aire acondicionado split"],
];

const TOKEN_SYNONYMS: Record<string, string[]> = {
  "1/2": ["media", "medio"],
  "3/4": ["tres", "cuartos"],
  "1/4": ["cuarto"],
  cano: ["tubo"],
  canos: ["tubos"],
  aa: ["aire", "acondicionado"],
};

function normalizeSearchText(value: string) {
  let output = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/+\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of PHRASE_NORMALIZATIONS) {
    output = output.replace(pattern, replacement);
  }

  return output.replace(/\s+/g, " ").trim();
}

function getBaseTokens(value: string) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenize(value: string) {
  const baseTokens = getBaseTokens(value);
  const expanded = new Set<string>();
  baseTokens.forEach((token) => {
    expanded.add(token);
    (TOKEN_SYNONYMS[token] ?? []).forEach((synonym) => {
      normalizeSearchText(synonym)
        .split(" ")
        .filter(Boolean)
        .forEach((part) => expanded.add(part));
    });
  });

  return [...expanded];
}

function buildItemText(item: Item) {
  return normalizeSearchText([
    item.sku,
    item.name,
    item.supplier ?? "",
    item.brand ?? "",
    item.model ?? "",
    item.attributes ?? "",
    item.category ?? "",
  ].join(" "));
}

function scoreTextMatch(queryText: string, candidateText: string) {
  if (!queryText || !candidateText) return 0;
  if (candidateText === queryText) return 120;
  if (candidateText.startsWith(queryText)) return 90;
  if (candidateText.includes(queryText)) return 72;
  return 0;
}

function scoreTokenOverlap(queryTokens: string[], candidateText: string) {
  if (queryTokens.length === 0 || !candidateText) return { score: 0, matches: 0 };

  let score = 0;
  let matches = 0;

  queryTokens.forEach((token) => {
    if (candidateText.includes(token)) {
      score += token.length >= 4 ? 16 : 8;
      matches += 1;
    }
  });

  return { score, matches };
}

function tokenMatchesCandidate(token: string, candidateText: string) {
  if (!token || !candidateText) return false;
  if (candidateText.includes(token)) return true;

  return (TOKEN_SYNONYMS[token] ?? []).some((synonym) => {
    const normalized = normalizeSearchText(synonym);
    if (!normalized) return false;
    if (candidateText.includes(normalized)) return true;
    return normalized.split(" ").some((part) => candidateText.includes(part));
  });
}

function satisfiesQuery(baseTokens: string[], candidateText: string) {
  if (baseTokens.length === 0 || !candidateText) return false;
  return baseTokens.every((token) => tokenMatchesCandidate(token, candidateText));
}

export function rankNaturalItemSearch(params: {
  items: Item[];
  aliases: ItemSearchAliasRecord[];
  query: string;
}) {
  const queryText = normalizeSearchText(params.query);
  const queryBaseTokens = getBaseTokens(params.query);
  const queryTokens = tokenize(params.query);
  if (!queryText) return params.items;

  const aliasesByItemId = new Map<string, ItemSearchAliasRecord[]>();
  params.aliases.forEach((alias) => {
    if (!aliasesByItemId.has(alias.item_id)) aliasesByItemId.set(alias.item_id, []);
    aliasesByItemId.get(alias.item_id)!.push(alias);
  });

  return params.items
    .map((item) => {
      const itemText = buildItemText(item);
      const itemMatched = satisfiesQuery(queryBaseTokens, itemText);
      const itemTokenResult = scoreTokenOverlap(queryTokens, itemText);
      const nameScore = scoreTextMatch(queryText, normalizeSearchText(item.name));
      const skuScore = scoreTextMatch(queryText, normalizeSearchText(item.sku));
      const baseScore = itemMatched ? Math.max(nameScore, skuScore) + itemTokenResult.score : 0;

      const aliasRank = (aliasesByItemId.get(item.id) ?? []).reduce((best, alias) => {
        const aliasText = normalizeSearchText(alias.alias);
        if (!satisfiesQuery(queryBaseTokens, aliasText)) {
          return best;
        }
        const tokenResult = scoreTokenOverlap(queryTokens, aliasText);
        const score =
          scoreTextMatch(queryText, aliasText) +
          tokenResult.score +
          (alias.is_supplier_code ? 8 : 0);

        if (score > best.score) {
          return { score, matches: tokenResult.matches };
        }

        return best;
      }, { score: 0, matches: 0 });

      const score = Math.max(baseScore, aliasRank.score);
      const tokenMatches = Math.max(itemTokenResult.matches, aliasRank.matches);
      const phraseMatched = Math.max(nameScore, skuScore, aliasRank.score) > 0 || itemMatched;

      return { item, score, tokenMatches, phraseMatched };
    })
    .filter((entry) => {
      if (entry.score <= 0) return false;
      if (queryBaseTokens.length <= 1) return entry.phraseMatched;
      return entry.phraseMatched || entry.tokenMatches >= queryBaseTokens.length;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.item.name.localeCompare(right.item.name);
    })
    .map((entry) => entry.item);
}

function naturalSearchHint(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return null;
  if (normalized.includes("1/2")) return "Incluye equivalencias como media o medio.";
  if (normalized.includes("aire acondicionado")) return "Incluye equivalencias como AA o split.";
  return null;
}
