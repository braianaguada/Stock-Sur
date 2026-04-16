import { useMemo } from "react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { currency, formatTime } from "@/lib/formatters";
import type { CashPendingReceiptState, CashSaleRow, ReceiptKind, RemitoOption } from "../types";
import { formatRemitoOptionLabel } from "../utils";

type CashReceiptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSale: CashSaleRow | null;
  pendingReceiptKind: ReceiptKind;
  pendingRemitoId: string;
  pendingReceiptReference: string;
  availableRemitos: RemitoOption[];
  saving: boolean;
  canSave: boolean;
  onPendingReceiptKindChange: (value: ReceiptKind) => void;
  onPendingRemitoIdChange: (value: string) => void;
  onPendingReceiptReferenceChange: (value: string) => void;
  onSave: (state: CashPendingReceiptState) => void;
};

export function CashReceiptDialog({
  open,
  onOpenChange,
  selectedSale,
  pendingReceiptKind,
  pendingRemitoId,
  pendingReceiptReference,
  availableRemitos,
  saving,
  canSave,
  onPendingReceiptKindChange,
  onPendingRemitoIdChange,
  onPendingReceiptReferenceChange,
  onSave,
}: CashReceiptDialogProps) {
  const remitoOptionLabels = useMemo(
    () => new Map(availableRemitos.map((remito) => [remito.id, formatRemitoOptionLabel(remito)])),
    [availableRemitos],
  );

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar comprobante"
      description="La venta ya cuenta en caja. Desde acá solo completás el comprobante faltante."
      footer={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              onSave({
                selectedSale,
                pendingReceiptKind,
                pendingRemitoId,
                pendingReceiptReference,
              })
            }
            disabled={saving || !canSave}
          >
            {saving ? "Guardando..." : "Guardar comprobante"}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <p className="font-medium">{selectedSale?.customer_name_snapshot ?? "Consumidor final"}</p>
          <p className="text-muted-foreground">
            {selectedSale ? `${formatTime(selectedSale.sold_at)} · ${currency.format(Number(selectedSale.amount_total))}` : ""}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Tipo de comprobante</Label>
          <Select value={pendingReceiptKind} onValueChange={(value) => onPendingReceiptKindChange(value as ReceiptKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="REMITO">Remito</SelectItem>
              <SelectItem value="FACTURA">Factura</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {pendingReceiptKind === "REMITO" || pendingReceiptKind === "FACTURA" ? (
          <div className="space-y-2">
            <Label>{pendingReceiptKind === "REMITO" ? "Remito emitido" : "Remito facturado"}</Label>
            <Select value={pendingRemitoId} onValueChange={onPendingRemitoIdChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar remito facturable" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Seleccionar remito facturable</SelectItem>
                {availableRemitos.map((remito) => (
                  <SelectItem key={remito.id} value={remito.id}>
                    {remitoOptionLabels.get(remito.id) ?? formatRemitoOptionLabel(remito)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {pendingReceiptKind === "FACTURA" ? (
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">La caja toma el monto y la referencia desde el remito facturado seleccionado.</p>
            <p className="mt-1 font-mono font-medium">{pendingReceiptReference || "Sin factura asociada"}</p>
          </div>
        ) : null}
      </div>
    </EntityDialog>
  );
}
