import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar comprobante</DialogTitle>
          <DialogDescription>La venta ya cuenta en caja. Desde acá solo completás el comprobante faltante.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{selectedSale?.customer_name_snapshot ?? "Consumidor final"}</p>
            <p className="text-muted-foreground">{selectedSale ? `${formatTime(selectedSale.sold_at)} · ${currency.format(Number(selectedSale.amount_total))}` : ""}</p>
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
          {pendingReceiptKind === "REMITO" ? (
            <div className="space-y-2">
              <Label>Remito emitido</Label>
              <Select value={pendingRemitoId} onValueChange={onPendingRemitoIdChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar remito del día" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seleccionar remito del día</SelectItem>
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
            <div className="space-y-2">
              <Label htmlFor="pending-receipt-reference">Referencia de factura</Label>
              <Input
                id="pending-receipt-reference"
                value={pendingReceiptReference}
                onChange={(event) => onPendingReceiptReferenceChange(event.target.value)}
                placeholder="Ej. B 0009-00001782"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
