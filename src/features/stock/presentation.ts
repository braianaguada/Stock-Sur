import type { BadgeTone } from "@/components/common/VisualSystem";
import type { DemandProfile, MovementType, StockHealth } from "@/features/stock/types";
import { formatStockQuantity } from "@/lib/stock-quantity";

type BadgePresentation = {
  label: string;
  tone: BadgeTone;
};

export const stockHealthBadge = {
  GREEN: { label: "Operativo", tone: "success" },
  YELLOW: { label: "Atención", tone: "warning" },
  RED: { label: "Crítico", tone: "danger" },
  GRAY: { label: "Sin datos", tone: "muted" },
} satisfies Record<StockHealth, BadgePresentation>;

export const demandProfileBadge = {
  LOW: { label: "Rotación baja", tone: "info" },
  MEDIUM: { label: "Rotación media", tone: "info" },
  HIGH: { label: "Rotación alta", tone: "info" },
} satisfies Record<DemandProfile, BadgePresentation>;

export const movementTypeBadge = {
  IN: { label: "Entrada", tone: "success" },
  OUT: { label: "Salida", tone: "info" },
  ADJUSTMENT: { label: "Ajuste", tone: "warning" },
} satisfies Record<MovementType, BadgePresentation>;

export function getStockLevelBadge(stock: number | undefined, unit: string | null): BadgePresentation {
  if (stock === undefined) return { label: "Stock no disponible", tone: "muted" };
  if (stock <= 0) return { label: "Sin stock", tone: "danger" };
  if (stock <= 5) return { label: `Stock bajo · ${formatStockQuantity(stock, unit)}`, tone: "warning" };
  return { label: `Disponible · ${formatStockQuantity(stock, unit)}`, tone: "success" };
}
