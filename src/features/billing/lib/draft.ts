import type { CashMovementRow } from "@/features/cash/types";

type DraftActionParams = {
  billingEnabled: boolean;
  canCreate: boolean;
  sale: CashMovementRow;
  billedSourceIds: ReadonlySet<string>;
};

export function canShowCreateBillingDraftAction({
  billingEnabled,
  canCreate,
  sale,
  billedSourceIds,
}: DraftActionParams) {
  return (
    billingEnabled
    && canCreate
    && sale.movement_kind === "SALE"
    && sale.status !== "ANULADA"
    && sale.receipt_kind === "REMITO"
    && Boolean(sale.document_id)
    && !billedSourceIds.has(sale.id)
  );
}

export function getBillingDraftBlockReason({ billingEnabled, canCreate, sale, billedSourceIds }: DraftActionParams) {
  if (!billingEnabled) return "Facturacion no habilitada";
  if (!canCreate) return "Sin permiso para crear borradores fiscales";
  if (sale.movement_kind !== "SALE") return "Solo aplica a ventas de caja";
  if (sale.status === "ANULADA") return "La venta esta anulada";
  if (sale.receipt_kind !== "REMITO" || !sale.document_id) return "La venta debe tener un remito asociado";
  if (billedSourceIds.has(sale.id)) return "Ya existe un borrador fiscal para esta venta";
  return null;
}
