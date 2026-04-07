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
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { ITEM_UNIT_OPTIONS } from "@/features/items/constants";
import type { Item, ItemAlias } from "@/features/items/types";

type ItemFormState = {
  sku: string;
  name: string;
  brand: string;
  model: string;
  unit: string;
  category: string;
  demand_profile: Item["demand_profile"];
  demand_monthly_estimate: string;
};

type ItemFormDialogProps = {
  open: boolean;
  editingItem: Item | null;
  form: ItemFormState;
  aliases: ItemAlias[];
  newAlias: string;
  isSupplierCode: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onFormChange: (next: ItemFormState) => void;
  onGenerateSku: () => void;
  onNewAliasChange: (value: string) => void;
  onSupplierCodeChange: (checked: boolean) => void;
  onAddAlias: () => void;
  onDeleteAlias: (alias: ItemAlias) => void;
};

export function ItemFormDialog({
  open,
  editingItem,
  form,
  aliases,
  newAlias,
  isSupplierCode,
  isSaving,
  onOpenChange,
  onSubmit,
  onFormChange,
  onGenerateSku,
  onNewAliasChange,
  onSupplierCodeChange,
  onAddAlias,
  onDeleteAlias,
}: ItemFormDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingItem ? "Editar ítem" : "Nuevo ítem"}
      contentClassName="sm:max-w-2xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>SKU</Label>
            <Button type="button" variant="outline" size="sm" onClick={onGenerateSku}>
              Autogenerar
            </Button>
          </div>
          <Input
            value={form.sku}
            onChange={(event) => onFormChange({ ...form, sku: event.target.value })}
            placeholder="Ej: BOMBA-001"
          />
        </div>
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input
            value={form.name}
            onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Marca</Label>
            <Input
              value={form.brand}
              onChange={(event) => onFormChange({ ...form, brand: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Modelo</Label>
            <Input
              value={form.model}
              onChange={(event) => onFormChange({ ...form, model: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Unidad *</Label>
            <Select value={form.unit || "un"} onValueChange={(value) => onFormChange({ ...form, unit: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar unidad" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_UNIT_OPTIONS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Input
              value={form.category}
              onChange={(event) => onFormChange({ ...form, category: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tipo de demanda *</Label>
          <Select
            value={form.demand_profile}
            onValueChange={(value) => onFormChange({ ...form, demand_profile: value as Item["demand_profile"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja rotación</SelectItem>
              <SelectItem value="MEDIUM">Rotación media</SelectItem>
              <SelectItem value="HIGH">Alta rotación</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Consumo mensual estimado (opcional)</Label>
          <Input
            type="number"
            min={0}
            step="any"
            placeholder="Ej: 7"
            value={form.demand_monthly_estimate}
            onChange={(event) => onFormChange({ ...form, demand_monthly_estimate: event.target.value })}
          />
        </div>
        {editingItem ? (
          <div className="space-y-3 rounded-md border p-3">
            <div>
              <h3 className="text-sm font-semibold">Alias/Códigos</h3>
              <p className="text-xs text-muted-foreground">Administrá códigos alternativos del ítem.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Nuevo alias..."
                value={newAlias}
                onChange={(event) => onNewAliasChange(event.target.value)}
                className="flex-1"
              />
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isSupplierCode}
                  onChange={(event) => onSupplierCodeChange(event.target.checked)}
                  className="rounded"
                />
                Cód. proveedor
              </label>
              <Button type="button" size="sm" onClick={onAddAlias}>
                Agregar
              </Button>
            </div>
            <div className="space-y-1">
              {aliases.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">Sin alias</p>
              ) : aliases.map((alias) => (
                <div key={alias.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{alias.alias}</span>
                    {alias.is_supplier_code ? (
                      <Badge variant="outline" className="text-xs">
                        código
                      </Badge>
                    ) : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteAlias(alias)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
