import { StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityDialog } from "@/components/common/EntityDialog";
import { buildItemDisplayName } from "@/lib/item-display";
import { formatStockQuantity } from "@/lib/stock-quantity";
import { cn } from "@/lib/utils";
import { Loader2, Package, Search } from "lucide-react";
import type { MovementType, SearchableItem, StockMovementForm } from "@/features/stock/types";

type StockMovementDialogProps = {
  open: boolean;
  form: StockMovementForm;
  itemSearch: string;
  availableItems: SearchableItem[];
  stockByItemId: Map<string, number>;
  selectedItem: SearchableItem | null;
  searchingItems: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onFormChange: (form: StockMovementForm) => void;
  onItemSearchChange: (value: string) => void;
  onSelectedItemChange: (item: SearchableItem | null) => void;
};

function stockTone(stock: number) {
  if (stock <= 0) return "danger";
  if (stock <= 5) return "warning";
  return "success";
}

export function StockMovementDialog({
  open,
  form,
  itemSearch,
  availableItems,
  stockByItemId,
  selectedItem,
  searchingItems,
  isSaving,
  onOpenChange,
  onSubmit,
  onFormChange,
  onItemSearchChange,
  onSelectedItemChange,
}: StockMovementDialogProps) {
  const selectedStock = selectedItem ? stockByItemId.get(selectedItem.id) : undefined;
  const selectedTone = selectedStock === undefined ? null : stockTone(selectedStock);
  const hasSearch = itemSearch.trim().length > 0;

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title="Nuevo movimiento">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label>Buscar ítem</Label>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={itemSearch}
                onChange={(event) => onItemSearchChange(event.target.value)}
                placeholder="Buscar por nombre, SKU, marca, modelo o atributos..."
                className="border-0 pl-9 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {hasSearch ? (
              <div className="max-h-52 overflow-auto border-t border-border/70">
                {searchingItems ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando ítems...</p>
                ) : availableItems.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No se encontraron ítems.</p>
                ) : (
                  availableItems.map((item) => {
                    const itemStock = stockByItemId.get(item.id);
                    const tone = itemStock === undefined ? null : stockTone(itemStock);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelectedItemChange(item);
                          onFormChange({ ...form, item_id: item.id });
                          onItemSearchChange("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80",
                          selectedItem?.id === item.id && "bg-primary/10",
                        )}
                      >
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {buildItemDisplayName({
                            name: item.name,
                            brand: item.brand,
                            model: item.model,
                            attributes: item.attributes,
                          })}
                        </span>
                        <StatusBadge tone={tone ?? "muted"} className="shrink-0 tabular-nums">
                          {itemStock === undefined ? "Stock no disponible" : formatStockQuantity(itemStock, item.unit)}
                        </StatusBadge>
                      </button>
                    );
                  })
                )}
              </div>
            ) : selectedItem ? (
              <div className="flex items-start justify-between gap-3 border-t border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Producto seleccionado</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {buildItemDisplayName({
                      name: selectedItem.name,
                      brand: selectedItem.brand,
                      model: selectedItem.model,
                      attributes: selectedItem.attributes,
                    })}
                  </p>
                </div>
                <StatusBadge tone={selectedTone ?? "muted"} className="flex items-center gap-1.5 tabular-nums">
                  <Package className="h-4 w-4" />
                  {selectedStock === undefined
                    ? "Stock no disponible"
                    : formatStockQuantity(selectedStock, selectedItem.unit)}
                </StatusBadge>
              </div>
            ) : (
              <p className="border-t border-border/70 px-3 py-2.5 text-sm text-muted-foreground">
                Seleccioná un producto para registrar el movimiento.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(value) => onFormChange({ ...form, type: value as MovementType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">Entrada</SelectItem>
                <SelectItem value="OUT">Salida</SelectItem>
                <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.quantity}
              onChange={(event) => onFormChange({ ...form, quantity: event.target.value })}
            />
          </div>
        </div>

        {form.type === "ADJUSTMENT" ? (
          <div className="space-y-2">
            <Label>Sentido del ajuste</Label>
            <Select
              value={form.adjustment_direction}
              onValueChange={(value) => onFormChange({ ...form, adjustment_direction: value as "ADD" | "REMOVE" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADD">Sumar stock</SelectItem>
                <SelectItem value="REMOVE">Restar stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Referencia</Label>
          <Input
            value={form.reference}
            onChange={(event) => onFormChange({ ...form, reference: event.target.value })}
            placeholder="Ej.: Ajuste, compra, remito..."
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || !form.item_id}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
