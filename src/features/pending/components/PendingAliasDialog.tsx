import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PendingLine } from "@/features/pending/types";

type PendingAliasDialogProps = {
  open: boolean;
  line: PendingLine | null;
  aliasValue: string;
  newItemName: string;
  saveAsSupplierCodeAlias: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onAliasChange: (value: string) => void;
  onNewItemNameChange: (value: string) => void;
  onSupplierCodeAliasChange: (checked: boolean) => void;
  onAssignWithoutAlias: () => void;
  onAssignWithAlias: () => void;
  onCreateItemWithAlias: () => void;
};

export function PendingAliasDialog({
  open,
  line,
  aliasValue,
  newItemName,
  saveAsSupplierCodeAlias,
  isSubmitting,
  onOpenChange,
  onAliasChange,
  onNewItemNameChange,
  onSupplierCodeAliasChange,
  onAssignWithoutAlias,
  onAssignWithAlias,
  onCreateItemWithAlias,
}: PendingAliasDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Crear alias"
      contentClassName="sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="alias">Alias sugerido (editable)</Label>
          <Input id="alias" value={aliasValue} onChange={(event) => onAliasChange(event.target.value)} />
        </div>

        {line?.supplier_code ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="supplier-code-alias"
              checked={saveAsSupplierCodeAlias}
              onCheckedChange={(checked) => onSupplierCodeAliasChange(Boolean(checked))}
            />
            <Label htmlFor="supplier-code-alias">
              Guardar tambien como alias-codigo ({line.supplier_code})
            </Label>
          </div>
        ) : null}

        <div className="space-y-2 rounded-2xl border p-3">
          <Label htmlFor="new-item-name">Nuevo item (para crear item + alias)</Label>
          <Input
            id="new-item-name"
            value={newItemName}
            onChange={(event) => onNewItemNameChange(event.target.value)}
            placeholder="Nombre del nuevo item"
          />
        </div>

        <div className="grid gap-2">
          <Button variant="outline" onClick={onAssignWithoutAlias} disabled={isSubmitting}>
            Asignar sin alias
          </Button>
          <Button onClick={onAssignWithAlias} disabled={isSubmitting}>
            Asignar y crear alias
          </Button>
          <Button variant="secondary" onClick={onCreateItemWithAlias} disabled={isSubmitting}>
            Crear item nuevo + alias
          </Button>
        </div>
      </div>
    </EntityDialog>
  );
}
