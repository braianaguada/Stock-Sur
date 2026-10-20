import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSupplierComparisonVersions, type SupplierComparisonVersionOption } from "../comparison/queries";
import { fetchSupplier, fetchSupplierCatalogLines } from "../queries";
import { SupplierListProducts } from "./SupplierListProducts";
import type { DisplayCurrency, SupplierCartItem } from "../pricing";

function ComparisonPanel({ companyId, option, search, currency, rate, onAdd }: {
  companyId: string; option: SupplierComparisonVersionOption; search: string; currency: DisplayCurrency; rate?: number; onAdd: (item: SupplierCartItem) => void;
}) {
  const supplier = useQuery({ queryKey: ["supplier-pricing", companyId, option.supplierId], queryFn: () => fetchSupplier(companyId, option.supplierId) });
  const lines = useQuery({ queryKey: ["supplier-comparison-lines", companyId, option.id, search], queryFn: () => fetchSupplierCatalogLines({ companyId, versionId: option.id, search }) });
  return <section className="min-w-0 space-y-3 rounded-lg border bg-card p-3">
    <div><h2 className="font-semibold">{option.supplierName}</h2><p className="text-sm text-muted-foreground">{option.listName} · {new Date(option.importedAt).toLocaleDateString("es-AR")}</p></div>
    {supplier.error || lines.error ? <p role="alert" className="text-sm text-destructive">No se pudo cargar la lista. <Button variant="link" onClick={() => { void supplier.refetch(); void lines.refetch(); }}>Reintentar</Button></p> : supplier.data ? <SupplierListProducts key={`${option.id}:${search}`} compact supplier={supplier.data} lines={lines.data ?? []} currency={currency} rate={rate} loading={lines.isLoading} onAdd={(line, quantity) => onAdd({ supplierId: option.supplierId, versionId: option.id, listName: option.listName, line, quantity })} /> : <p className="text-sm">Cargando proveedor…</p>}
  </section>;
}

export function SupplierListsComparison({ companyId, currency, rate, onAdd }: { companyId: string; currency: DisplayCurrency; rate?: number; onAdd: (item: SupplierCartItem) => void }) {
  const options = useQuery({ queryKey: ["supplier-comparison-versions", companyId], queryFn: () => fetchSupplierComparisonVersions(companyId) });
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [search, setSearch] = useState("");
  const leftOption = options.data?.find((option) => option.id === left);
  const rightOption = options.data?.find((option) => option.id === right);
  return <div className="space-y-4">
    <Input aria-label="Buscar en ambas listas" placeholder="Buscar productos en ambas listas" value={search} onChange={(event) => setSearch(event.target.value)} />
    <p className="text-xs text-muted-foreground">Compará el mismo producto y su unidad de venta. Los nombres similares no garantizan que las presentaciones sean equivalentes.</p>
    {options.error ? <p role="alert" className="text-destructive">No se pudieron cargar las listas.</p> : null}
    {!options.isLoading && !options.error && new Set(options.data?.map((option) => option.supplierId)).size < 2 ? <p className="text-sm text-muted-foreground">Necesitás listas de al menos dos proveedores activos para comparar.</p> : null}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {([0, 1] as const).map((side) => {
        const selected = side === 0 ? leftOption : rightOption;
        const other = side === 0 ? rightOption : leftOption;
        return <div key={side} className="min-w-0 space-y-3"><Select value={side === 0 ? left : right} onValueChange={side === 0 ? setLeft : setRight}><SelectTrigger aria-label={`Lista ${side + 1}`}><SelectValue placeholder="Elegir proveedor y lista" /></SelectTrigger><SelectContent>{(options.data ?? []).filter((option) => option.supplierId !== other?.supplierId).map((option) => <SelectItem key={option.id} value={option.id}>{option.supplierName} · {option.listName}</SelectItem>)}</SelectContent></Select>
          {selected ? <ComparisonPanel key={selected.id} companyId={companyId} option={selected} search={search} currency={currency} rate={rate} onAdd={onAdd} /> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Seleccioná una lista</div>}
        </div>;
      })}
    </div>
  </div>;
}
