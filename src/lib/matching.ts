export type MatchReason = "SUPPLIER_CODE" | "ALIAS_TOKEN" | "ALIAS_CONTAINS" | "NONE";

export interface AliasRecord {
  item_id: string;
  alias: string;
  is_supplier_code: boolean;
}

export interface MatchResult {
  itemId: string | null;
  reason: MatchReason;
}

const MIN_ALIAS_LENGTH = 4;

export function normalizeText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliasIndex(aliases: AliasRecord[]) {
  return aliases
    .map((a) => ({
      ...a,
      normalizedAlias: normalizeText(a.alias),
    }))
    .filter((a) => a.normalizedAlias.length >= MIN_ALIAS_LENGTH || a.is_supplier_code);
}

function getTokenSet(normalizedText: string): Set<string> {
  if (!normalizedText) return new Set<string>();
  return new Set(normalizedText.split(" ").filter((token) => token.length >= MIN_ALIAS_LENGTH));
}

export function matchImportLine(args: {
  supplierCode?: string | null;
  rawDescription: string;
  aliases: AliasRecord[];
}): MatchResult {
  const supplierCodeNormalized = normalizeText(args.supplierCode ?? "");
  const descriptionNormalized = normalizeText(args.rawDescription);
  const aliases = buildAliasIndex(args.aliases);

  if (supplierCodeNormalized) {
    const supplierCodeMatch = aliases.find((a) => {
      if (!a.normalizedAlias) return false;
      if (a.is_supplier_code) return a.normalizedAlias === supplierCodeNormalized;
      return a.normalizedAlias === supplierCodeNormalized;
    });

    if (supplierCodeMatch) {
      return { itemId: supplierCodeMatch.item_id, reason: "SUPPLIER_CODE" };
    }
  }

  const descriptionTokens = getTokenSet(descriptionNormalized);
  const tokenMatches = aliases.filter((a) => {
    if (a.is_supplier_code || a.normalizedAlias.length < MIN_ALIAS_LENGTH) return false;
    return descriptionTokens.has(a.normalizedAlias);
  });

  const uniqueTokenItemIds = new Set(tokenMatches.map((m) => m.item_id));
  if (uniqueTokenItemIds.size === 1 && tokenMatches[0]) {
    return { itemId: tokenMatches[0].item_id, reason: "ALIAS_TOKEN" };
  }

  const containsMatches = aliases.filter((a) => {
    if (a.is_supplier_code || a.normalizedAlias.length < MIN_ALIAS_LENGTH) return false;
    return descriptionNormalized.includes(a.normalizedAlias);
  });
  const uniqueContainsItemIds = new Set(containsMatches.map((m) => m.item_id));

  if (uniqueContainsItemIds.size === 1 && containsMatches[0]) {
    return { itemId: containsMatches[0].item_id, reason: "ALIAS_CONTAINS" };
  }

  return { itemId: null, reason: "NONE" };
}

export function buildSuggestedAlias(rawDescription: string): string {
  return normalizeText(rawDescription).slice(0, 80).trim();
}
