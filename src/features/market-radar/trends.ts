export type MovementSample = {
  item_id: string;
  quantity: number;
  created_at: string;
};

export type ItemSample = {
  id: string;
  name: string;
  sku: string;
  unit: string;
};

export type TrendSignal = "RISING" | "STABLE" | "FALLING" | "LOW_VOLUME";

export type ItemTrend = ItemSample & {
  currentUnits: number;
  previousUnits: number;
  changePct: number | null;
  signal: TrendSignal;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyTrend(currentUnits: number, previousUnits: number): TrendSignal {
  if (currentUnits < 3 && previousUnits < 3) return "LOW_VOLUME";
  if (previousUnits === 0) return currentUnits >= 3 ? "RISING" : "LOW_VOLUME";

  const changePct = ((currentUnits - previousUnits) / previousUnits) * 100;
  if (changePct >= 25 && currentUnits >= 3) return "RISING";
  if (changePct <= -25 && previousUnits >= 3) return "FALLING";
  return "STABLE";
}

export function buildItemTrends(items: ItemSample[], movements: MovementSample[], asOf = new Date()): ItemTrend[] {
  const currentStart = new Date(asOf.getTime() - 30 * DAY_MS);
  const previousStart = new Date(asOf.getTime() - 60 * DAY_MS);
  const totals = new Map<string, { current: number; previous: number }>();

  for (const movement of movements) {
    const occurredAt = new Date(movement.created_at);
    if (!Number.isFinite(occurredAt.getTime()) || occurredAt < previousStart || occurredAt > asOf) continue;
    const bucket = totals.get(movement.item_id) ?? { current: 0, previous: 0 };
    if (occurredAt >= currentStart) bucket.current += Math.abs(Number(movement.quantity) || 0);
    else bucket.previous += Math.abs(Number(movement.quantity) || 0);
    totals.set(movement.item_id, bucket);
  }

  const rank: Record<TrendSignal, number> = { RISING: 0, STABLE: 1, FALLING: 2, LOW_VOLUME: 3 };
  return items.flatMap((item) => {
    const total = totals.get(item.id);
    if (!total || (total.current === 0 && total.previous === 0)) return [];
    return [{
      ...item,
      currentUnits: total.current,
      previousUnits: total.previous,
      changePct: total.previous > 0 ? ((total.current - total.previous) / total.previous) * 100 : null,
      signal: classifyTrend(total.current, total.previous),
    }];
  }).sort((a, b) => rank[a.signal] - rank[b.signal] || b.currentUnits - a.currentUnits || a.name.localeCompare(b.name));
}

