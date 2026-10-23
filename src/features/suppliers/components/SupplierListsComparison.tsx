import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Search } from "lucide-react";
import { DataState } from "@/components/common/DataState";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSupplierComparisonVersions, type SupplierComparisonVersionOption } from "../comparison/queries";
import { fetchSupplier, fetchSupplierCatalogLines } from "../queries";
import { SupplierListProducts } from "./SupplierListProducts";
import type { DisplayCurrency, SupplierCartItem } from "../pricing";

function ComparisonPanel({ companyId, option, search, currency, rate, onAdd }: {
  companyId: string;
  option: SupplierComparisonVersionOption;
  search: string;
  currency: DisplayCurrency;
  rate?: number;
  onAdd: (item: SupplierCartItem) => void;
}) {
  const supplier = useQuery({ queryKey: ["supplier-pricing", companyId, option.supplierId], queryFn: () => fetchSupplier(companyId, option.supplierId) });
  const lines = useQuery({ queryKey: ["supplier-comparison-lines", companyId, option.id, search], queryFn: () => fetchSupplierCatalogLines({ companyId, versionId: option.id, search }) });

  if (supplier.error || lines.error) {
    return <DataState variant="error" title="No se pudo cargar la lista" actionLabel="Reintentar" onAction={() => { void supplier.refetch(); void lines.refetch(); }} />;
  }
  if (!supplier.data) return <DataState variant="loading" title="Cargando proveedor…" />;

  return <SupplierListProducts
    key={`${option.id}:${search}`}
    compact
    supplier={supplier.data}
    lines={lines.data ?? []}
    currency={currency}
    rate={rate}
    loading={lines.isLoading}
    onAdd={(line, quantity) => onAdd({ supplierId: option.supplierId, versionId: option.id, listName: option.listName, line, quantity })}
  />;
}

export function SupplierListsComparison({ companyId, currency, rate, onAdd, toolbar, initialVersionId = "" }: {
  companyId: string;
  currency: DisplayCurrency;
  rate?: number;
  onAdd: (item: SupplierCartItem) => void;
  toolbar?: ReactNode;
  initialVersionId?: string;
}) {
  const options = useQuery({ queryKey: ["supplier-comparison-versions", companyId], queryFn: () => fetchSupplierComparisonVersions(companyId) });
  const [left, setLeft] = useState(initialVersionId);
  const [right, setRight] = useState("");
  const [search, setSearch] = useState("");
  const leftOption = options.data?.find((option) => option.id === left);
  const rightOption = options.data?.find((option) => option.id === right);
  const enoughSuppliers = new Set(options.data?.map((option) => option.supplierId)).size >= 2;

  return <Card>
    <CardHeader className="gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Comparar precios</h2>
          <p className="text-sm text-muted-foreground">Dos proveedores, una misma moneda. Sumá los productos que elijas al carrito.</p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9" aria-label="Buscar en ambas listas" placeholder="Buscar productos en ambas listas" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      {toolbar}
    </CardHeader>
    <CardContent className="space-y-4">
      {options.error ? <DataState variant="error" title="No se pudieron cargar las listas" actionLabel="Reintentar" onAction={() => void options.refetch()} />
        : options.isLoading ? <DataState variant="loading" title="Cargando listas para comparar…" />
          : !enoughSuppliers ? <DataState variant="empty" title="Falta otro proveedor para comparar" description="Cargá listas de al menos dos proveedores activos. Después vas a poder ver sus precios uno al lado del otro." icon={<ArrowLeftRight className="h-5 w-5" aria-hidden="true" />} />
            : <>
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                {([0, 1] as const).map((side) => {
                  const selected = side === 0 ? leftOption : rightOption;
                  const other = side === 0 ? rightOption : leftOption;
                  return <section key={side} aria-label={`Proveedor ${side + 1}`} className="min-w-0 space-y-4">
                    <div className="space-y-2 rounded-lg bg-muted/40 p-4">
                      <label htmlFor={`comparison-list-${side}`} className="text-sm font-medium">{side === 0 ? "Primer proveedor" : "Segundo proveedor"}</label>
                      <Select value={side === 0 ? left : right} onValueChange={side === 0 ? setLeft : setRight}>
                        <SelectTrigger id={`comparison-list-${side}`} aria-label={`Lista ${side + 1}`}><SelectValue placeholder="Elegir proveedor y lista" /></SelectTrigger>
                        <SelectContent>{(options.data ?? []).filter((option) => option.supplierId !== other?.supplierId).map((option) => <SelectItem key={option.id} value={option.id}>{option.supplierName} · {option.listName}</SelectItem>)}</SelectContent>
                      </Select>
                      {selected ? <p className="text-xs text-muted-foreground">Última carga: {new Date(selected.importedAt).toLocaleDateString("es-AR")}</p> : null}
                    </div>
                    {selected ? <ComparisonPanel key={selected.id} companyId={companyId} option={selected} search={search} currency={currency} rate={rate} onAdd={onAdd} />
                      : <DataState variant="empty" title={side === 0 ? "Elegí la primera lista" : "Elegí una lista de otro proveedor"} description="Vas a ver el precio neto, IVA, flete y total de cada producto." icon={<ArrowLeftRight className="h-5 w-5" aria-hidden="true" />} className="py-8" />}
                  </section>;
                })}
              </div>
              <p className="text-xs text-muted-foreground">Compará el mismo producto y su unidad de venta. Los nombres similares no garantizan que las presentaciones sean equivalentes.</p>
            </>}
    </CardContent>
  </Card>;
}
