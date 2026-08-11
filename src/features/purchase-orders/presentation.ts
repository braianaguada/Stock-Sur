import type { BadgeTone } from "@/components/common/VisualSystem";
import type { PurchaseOrderStatus } from "./types";

export const PURCHASE_ORDER_STATUS_LABELS = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  CANCELLED: "Cancelada",
} satisfies Record<PurchaseOrderStatus, string>;

export const PURCHASE_ORDER_STATUS_TONES = {
  DRAFT: "muted",
  SENT: "info",
  CANCELLED: "danger",
} satisfies Record<PurchaseOrderStatus, BadgeTone>;
