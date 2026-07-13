import { Badge } from "@/components/ui/badge";
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
  if (activeVersionId && isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando productos…</div>;
  if (lines.length === 0) return (
    <div className="grid min-h-48 place-items-center p-8 text-center">
      <div className="max-w-sm">
        <p className="font-medium text-foreground">{activeVersionId ? "No encontramos productos" : "Todavía no hay una lista seleccionada"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeVersionId ? "Probá con otra búsqueda." : "Elegí una versión en la sección Listas para consultar sus productos."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="divide-y" role="list" aria-label="Productos de la lista">
      {lines.map((line) => {
        const taxLabel = line.tax_treatment === "INCLUDED"
          ? "IVA incluido"
          : line.tax_treatment === "EXCLUDED"
            ? "Más IVA"
            : "IVA no informado";
        return (
          <article key={line.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(12rem,1fr)_minmax(8rem,auto)_5.5rem_auto] md:items-center" role="listitem">
            <div className="min-w-0">
              <p className="line-clamp-2 font-medium leading-snug" title={line.raw_description}>{line.product_name ?? line.raw_description}</p>
              {line.presentation_raw ? <p className="mt-1 text-xs font-medium text-foreground/75">{line.presentation_raw}</p> : null}
              {line.additional_description ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={line.additional_description}>{line.additional_description}</p> : null}
              {line.supplier_code ? <p className="mt-1 font-mono text-xs text-muted-foreground">Cód. {line.supplier_code}</p> : null}
            </div>
            <div className="space-y-1 justify-self-start md:justify-self-end md:text-right">
              <SupplierOfferPrice value={Number(line.cost)} currency={line.currency} />
              <Badge variant="outline" className="font-normal">{taxLabel}</Badge>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`catalog-quantity-${line.id}`} className="text-xs md:sr-only">Cantidad</Label>
              <Input id={`catalog-quantity-${line.id}`} type="number" min={1} step={1} value={quantities[line.id] ?? 1} onChange={(event) => onQuantityChange(line.id, event.target.value)} />
            </div>
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => onAdd(line)}>Agregar</Button>
          </article>
        );
      })}
    </div>
  );
}
