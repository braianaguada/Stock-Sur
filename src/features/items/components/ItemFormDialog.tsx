import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryBadge } from "@/components/common/VisualSystem";
import { Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import type { ItemFormState } from "@/features/items/form";
import { ItemSupplierSelect } from "./ItemSupplierSelect";
import { ProductPhysicalFields } from "./ProductPhysicalFields";
import { ITEM_UNIT_OPTIONS } from "@/features/items/constants";
import type { Item, ItemAlias } from "@/features/items/types";

type ItemFormDialogProps = {
  companyId: string;
  aliasSupplierId: string;
  onAliasSupplierChange: (id: string) => void;
  open: boolean;
  editingItem: Item | null;
  isDuplicating?: boolean;
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
  companyId, aliasSupplierId, onAliasSupplierChange,
  open,
  editingItem,
  isDuplicating = false,
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
      title={editingItem ? "Editar ítem" : isDuplicating ? "Duplicar ítem" : "Nuevo ítem"}
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
            <Label>Codigo</Label>
            {!editingItem && <Button type="button" variant="outline" size="sm" onClick={onGenerateSku}>
              Autogenerar
            </Button>}
          </div>
          <Input
            value={form.sku}
            onChange={(event) => onFormChange({ ...form, sku: event.target.value })}
            placeholder="Automatico al guardar"
            inputMode="numeric"
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
        <div className="grid gap-4 sm:grid-cols-1">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <ItemSupplierSelect companyId={companyId} value={form.supplier_id}
              onChange={(id,name) => onFormChange({ ...form, supplier_id: id, supplier: name })} />
            {!form.supplier_id && form.supplier && <p className="text-xs text-muted-foreground">Dato anterior: {form.supplier}. Selecciona un proveedor para asociarlo.</p>}
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
          <Label>Descripcion completa</Label>
          <Textarea value={form.description} onChange={event => onFormChange({ ...form, description: event.target.value })} rows={3} />
        </div>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Datos tecnicos y codigos alternativos</summary>
          <div className="mt-4 space-y-4">
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
        <div className="space-y-2">
          <Label>Atributos anteriores (compatibilidad)</Label>
          <Textarea
            value={form.attributes}
            onChange={(event) => onFormChange({ ...form, attributes: event.target.value })}
            placeholder="Ej: 18 x 21 MM x 2 M | CON ADHESIVO"
            rows={3}
          />
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
        <div className="space-y-2">
          <Label>Caracteristicas (una por linea, nombre: valor)</Label>
          <Textarea value={form.structured_attributes} onChange={event => onFormChange({ ...form, structured_attributes: event.target.value })} placeholder="Material: cobre" rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Observaciones tecnicas</Label>
          <Textarea value={form.technical_notes} onChange={event => onFormChange({ ...form, technical_notes: event.target.value })} rows={2} />
        </div>
        <ProductPhysicalFields form={form} onChange={onFormChange} />
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
            {isSupplierCode && <ItemSupplierSelect companyId={companyId} value={aliasSupplierId}
              onChange={id => onAliasSupplierChange(id)} />}
            <div className="space-y-1">
              {aliases.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">Sin alias</p>
              ) : aliases.map((alias) => (
                <div key={alias.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{alias.alias}</span>
                    {alias.supplier_id && <span className="text-xs text-muted-foreground">Proveedor asociado</span>}
                    {alias.is_supplier_code ? (
                      <CategoryBadge>
                        código
                      </CategoryBadge>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onDeleteAlias(alias)}
                    aria-label={`Eliminar alias ${alias.alias}`}
                    title={`Eliminar alias ${alias.alias}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
          </div>
        </details>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
