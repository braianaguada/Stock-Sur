export type ComparisonCurrency = "ARS" | "USD";

export interface SupplierComparisonOffer {
  id: string;
  versionId: string;
  supplierId: string;
  supplierName: string;
  listName: string;
  description: string;
  normalizedDescription: string | null;
  supplierCode: string | null;
  matchedItemId: string | null;
  cost: number;
  currency: ComparisonCurrency;
}

export type ComparisonMatchKind = "MATCHED_ITEM" | "NORMALIZED_EXACT";

export interface RankedComparisonOffer extends SupplierComparisonOffer {
  rank: number;
  differencePercent: number;
  arsReference: number | null;
  referenceRank: number | null;
  referenceDifferencePercent: number | null;
}

export interface SupplierComparisonGroup {
  id: string;
  title: string;
  matchKind: ComparisonMatchKind;
  offers: RankedComparisonOffer[];
}

export function normalizeComparisonDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("es-AR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function rankOffers(offers: SupplierComparisonOffer[], usdToArs: number | null) {
  const lowestByCurrency = new Map<ComparisonCurrency, number>();
  for (const offer of offers) {
    const current = lowestByCurrency.get(offer.currency);
    if (current === undefined || offer.cost < current) lowestByCurrency.set(offer.currency, offer.cost);
  }

  const sortedByCurrency = new Map<ComparisonCurrency, SupplierComparisonOffer[]>();
  for (const currency of ["ARS", "USD"] as const) {
    sortedByCurrency.set(currency, offers.filter((offer) => offer.currency === currency).sort((a, b) => a.cost - b.cost));
  }

  const ranked = offers.map<RankedComparisonOffer>((offer) => {
    const currencyOffers = sortedByCurrency.get(offer.currency) ?? [];
    const minimum = lowestByCurrency.get(offer.currency) ?? offer.cost;
    return {
      ...offer,
      rank: currencyOffers.findIndex((candidate) => candidate.id === offer.id) + 1,
      differencePercent: minimum > 0 ? ((offer.cost - minimum) / minimum) * 100 : 0,
      arsReference: offer.currency === "ARS" ? offer.cost : usdToArs ? offer.cost * usdToArs : null,
      referenceRank: null,
      referenceDifferencePercent: null,
    };
  });
  if (usdToArs) {
    const byReference = [...ranked].sort((a, b) => (a.arsReference ?? Infinity) - (b.arsReference ?? Infinity));
    const minimumReference = byReference[0]?.arsReference ?? null;
    byReference.forEach((offer, index) => {
      offer.referenceRank = index + 1;
      offer.referenceDifferencePercent = minimumReference && offer.arsReference !== null
        ? ((offer.arsReference - minimumReference) / minimumReference) * 100
        : 0;
    });
  }
  return ranked.sort((a, b) => {
    if (usdToArs && a.arsReference !== null && b.arsReference !== null) return a.arsReference - b.arsReference;
    if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
    return a.cost - b.cost;
  });
}

export function buildSupplierComparisonGroups(
  offers: SupplierComparisonOffer[],
  usdToArs: number | null = null,
): SupplierComparisonGroup[] {
  const groups = new Map<string, { matchKind: ComparisonMatchKind; title: string; offers: SupplierComparisonOffer[] }>();

  for (const offer of offers) {
    const normalized = normalizeComparisonDescription(offer.normalizedDescription || offer.description);
    if (!normalized) continue;
    const matchKind: ComparisonMatchKind = offer.matchedItemId ? "MATCHED_ITEM" : "NORMALIZED_EXACT";
    const key = offer.matchedItemId ? `item:${offer.matchedItemId}` : `description:${normalized}`;
    const current = groups.get(key);
    if (current) current.offers.push(offer);
    else groups.set(key, { matchKind, title: offer.description, offers: [offer] });
  }

  return [...groups.entries()]
    .map(([id, group]) => ({ ...group, id, offers: rankOffers(group.offers, usdToArs) }))
    .sort((a, b) => a.title.localeCompare(b.title, "es-AR"));
}
