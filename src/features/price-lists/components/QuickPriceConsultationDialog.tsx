import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StockBadge } from "@/features/price-lists/components/StockBadge";
import type { PriceListProductRow, PriceListSummary } from "@/features/price-lists/types";
import { formatMoney } from "@/features/price-lists/utils";
import { matchesNaturalItemSearch } from "@/features/items/search";
import { getOperationalPrice } from "@/features/pricing/operational-price";
import type { PriceRoundingConfig } from "@/features/pricing/rounding";

const RESULT_LIMIT = 30;

type QuickPriceConsultationDialogProps = {
  open: boolean;
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  resultsLoading?: boolean;
  resultsError?: string | null;
  onRetry?: () => void;
  page?: number;
  hasMore?: boolean;
  onPageChange?: (page: number) => void;
  priceLists: PriceListSummary[];
  selectedListId: string | null;
  products: PriceListProductRow[];
  stockByItemId: Map<string, number>;
  priceRoundingConfig?: PriceRoundingConfig | null;
  onOpenChange: (open: boolean) => void;
  onSelectedListIdChange: (priceListId: string) => void;
};

export function QuickPriceConsultationDialog({
  open,
  isLoading = false,
  searchValue,
  onSearchChange,
  resultsLoading = false,
  resultsError,
  onRetry,
  page = 1,
  hasMore = false,
  onPageChange,
  priceLists,
  selectedListId,
  products,
  stockByItemId,
  priceRoundingConfig,
  onOpenChange,
  onSelectedListIdChange,
}: QuickPriceConsultationDialogProps) {
  const [localSearch, setLocalSearch] = useState("");
  const search = searchValue ?? localSearch;
  const setSearch = onSearchChange ?? setLocalSearch;
  const normalizedSearch = search.trim();
  const matchingProducts = useMemo(
    () => searchValue !== undefined ? products : normalizedSearch
      ? products
        .filter((row) => matchesNaturalItemSearch({ id: row.item_id, ...row }, normalizedSearch))
        .slice(0, RESULT_LIMIT)
      : [],
    [normalizedSearch, products, searchValue],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} variant="form" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Consulta rápida de precios</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cargando listas y productos...
          </div>
        ) : priceLists.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Primero necesitás crear una lista de precios.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
              <Select value={selectedListId ?? undefined} onValueChange={onSelectedListIdChange}>
                <SelectTrigger aria-label="Lista para consultar">
                  <SelectValue placeholder="Elegir lista" />
                </SelectTrigger>
                <SelectContent>
                  {priceLists.map((priceList) => (
                    <SelectItem key={priceList.id} value={priceList.id}>{priceList.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Código, nombre, marca, modelo o atributo..."
                  className="pl-9"
                  aria-label="Buscar producto para consultar"
                />
              </div>
            </div>

            {resultsError ? (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{resultsError}</p>
                <Button type="button" variant="outline" onClick={onRetry}>Reintentar</Button>
              </div>
            ) : resultsLoading ? (
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">Buscando precios...</p>
            ) : !normalizedSearch ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Escribí al menos parte del código o nombre del producto.
              </div>
            ) : matchingProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay productos que coincidan en esta lista.
              </div>
            ) : (
              <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1" aria-label="Resultados de precios">
                {matchingProducts.map((product) => {
                  const operationalPrice = getOperationalPrice({
                    calculatedPrice: product.calculated_price,
                    manualOverridePrice: product.final_price_override,
                    manualPriceEnabled: product.manual_price_enabled,
                    config: priceRoundingConfig,
                  });

                  return (
                    <div key={product.item_id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{product.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {product.sku || "Sin código"}{product.brand ? ` · ${product.brand}` : ""}{product.model ? ` · ${product.model}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <StockBadge total={stockByItemId.get(product.item_id)} />
                        {product.needs_recalculation ? <StatusBadge tone="warning">Recalcular</StatusBadge> : null}
                      </div>
                      <div className="sm:min-w-32 sm:text-right">
                        <p className="font-mono text-lg font-bold">${formatMoney(operationalPrice.price)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {operationalPrice.source === "PRODUCT_OVERRIDE" ? "Personalizado" : "Precio de lista"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {onPageChange === undefined && matchingProducts.length === RESULT_LIMIT ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">Mostrando los primeros {RESULT_LIMIT} resultados. Afiná la búsqueda para reducirlos.</p>
                ) : null}
              </div>
            )}

            {onPageChange && normalizedSearch && !resultsError ? (
              <div className="flex items-center justify-between gap-2" aria-label="Paginas de precios">
                <Button type="button" variant="outline" disabled={page <= 1 || resultsLoading} onClick={() => onPageChange(page - 1)}>Anterior</Button>
                <span className="text-sm">Pagina {page}</span>
                <Button type="button" variant="outline" disabled={!hasMore || resultsLoading} onClick={() => onPageChange(page + 1)}>Siguiente</Button>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
