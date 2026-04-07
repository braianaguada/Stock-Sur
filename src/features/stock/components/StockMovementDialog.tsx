import { EntityDialog } from "@/components/common/EntityDialog";
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
import type { MovementType, SearchableItem, StockMovementForm } from "@/features/stock/types";

type StockMovementDialogProps = {
  open: boolean;
  form: StockMovementForm;
  itemSearch: string;
  availableItems: SearchableItem[];
  selectedItem: SearchableItem | null;
  searchingItems: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onFormChange: (form: StockMovementForm) => void;
  onItemSearchChange: (value: string) => void;
  onSelectedItemChange: (item: SearchableItem | null) => void;
};

export function StockMovementDialog({
  open,
  form,
  itemSearch,
  availableItems,
  selectedItem,
  searchingItems,
  isSaving,
  onOpenChange,
  onSubmit,
  onFormChange,
  onItemSearchChange,
  onSelectedItemChange,
}: StockMovementDialogProps) {
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
          <Input
            value={itemSearch}
            onChange={(event) => onItemSearchChange(event.target.value)}
            placeholder="Buscar por nombre, SKU, marca, modelo o alias..."
          />
          <div className="max-h-52 overflow-auto rounded-md border">
            {itemSearch.trim() === "" && availableItems.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Escribí para buscar un ítem.</p>
            ) : searchingItems ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Buscando ítems...</p>
            ) : availableItems.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No se encontraron ítems.</p>
            ) : (
              availableItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectedItemChange(item);
                    onFormChange({ ...form, item_id: item.id });
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                    selectedItem?.id === item.id ? "bg-muted" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {item.name} <span className="text-xs text-muted-foreground">({item.sku})</span>
                  </span>
                </button>
              ))
            )}
          </div>
          {selectedItem ? (
            <p className="text-sm text-muted-foreground">
              Seleccionado: <span className="font-medium text-foreground">{selectedItem.name}</span>
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onValueChange={(value) => onFormChange({ ...form, type: value as MovementType })}
            >
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
            {isSaving ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
