import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplierOfferPrice } from "@/features/suppliers/components/SupplierOfferPrice";
import type { CatalogLine } from "@/features/suppliers/types";

export function SupplierCatalogLinesTable({ lines, activeVersionId, isLoading, quantities, onQuantityChange, onAdd }: {
  lines: CatalogLine[];
  activeVersionId: string | null;
  isLoading: boolean;
  quantities: Record<string, number>;
  onQuantityChange: (lineId: string, value: string) => void;
  onAdd: (line: CatalogLine) => void;
}) {
  if (activeVersionId && isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Cargando productos…</div>;
  if (lines.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">{activeVersionId ? "Sin resultados" : "Seleccioná una lista para ver sus productos"}</div>;

  return (
    <div className="divide-y" role="list" aria-label="Productos de la lista">
      {lines.map((line) => (
        <article key={line.id} className="grid gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" role="listitem">
          <div className="min-w-0">
            <p className="break-words font-medium leading-snug" title={line.raw_description}>{line.raw_description}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{line.supplier_code ?? "Sin código"}</p>
          </div>
          <SupplierOfferPrice value={Number(line.cost)} currency={line.currency} />
          <div className="flex items-end gap-2 sm:col-span-2 sm:justify-end">
            <div className="w-24 space-y-1">
              <Label htmlFor={`catalog-quantity-${line.id}`} className="text-xs">Cantidad</Label>
              <Input id={`catalog-quantity-${line.id}`} type="number" min={1} step={1} value={quantities[line.id] ?? 1} onChange={(event) => onQuantityChange(line.id, event.target.value)} />
            </div>
            <Button type="button" onClick={() => onAdd(line)}>Seleccionar</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
