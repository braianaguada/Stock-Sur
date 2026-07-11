import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplierOfferPrice } from "@/features/suppliers/components/SupplierOfferPrice";
import type { OrderLine } from "@/features/suppliers/types";

export function SupplierOrderTable({ rows, onQuantityChange, onRemove }: {
  rows: OrderLine[];
  onQuantityChange: (lineId: string, value: string) => void;
  onRemove: (lineId: string) => void;
}) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Sin productos seleccionados</div>;
  }

  return (
    <div className="divide-y rounded-lg border" aria-label="Bandeja de selección">
      {rows.map((row) => (
        <article key={row.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <div className="min-w-0">
            <p className="break-words font-medium leading-snug">{row.raw_description}</p>
            <p className="mt-1 text-xs text-muted-foreground">{row.supplier_code ?? "Sin código de proveedor"}</p>
          </div>
          <SupplierOfferPrice value={row.cost * row.quantity} currency={row.currency} className="sm:self-start" />
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <div className="w-24 space-y-1">
              <Label htmlFor={`order-quantity-${row.id}`} className="text-xs">Cantidad</Label>
              <Input id={`order-quantity-${row.id}`} type="number" min={1} step={1} value={row.quantity} onChange={(event) => onQuantityChange(row.id, event.target.value)} />
            </div>
            <span className="pb-2 text-xs text-muted-foreground">Unitario: <SupplierOfferPrice value={row.cost} currency={row.currency} className="font-normal" /></span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onRemove(row.id)}>Quitar</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
