import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/features/customers/types";

export type CustomerFormState = {
  name: string;
  cuit: string;
  email: string;
  phone: string;
  is_occasional: boolean;
};

type CustomerFormDialogProps = {
  open: boolean;
  editingCustomer: Customer | null;
  form: CustomerFormState;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: CustomerFormState) => void;
  onSubmit: () => void;
};

export function CustomerFormDialog({
  open,
  editingCustomer,
  form,
  isSaving,
  onOpenChange,
  onFormChange,
  onSubmit,
}: CustomerFormDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingCustomer ? "Editar cliente" : "Nuevo cliente"}
      contentClassName="sm:max-w-xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
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
            <Label>CUIT</Label>
            <Input
              value={form.cuit}
              onChange={(event) => onFormChange({ ...form, cuit: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefono</Label>
            <Input
              value={form.phone}
              onChange={(event) => onFormChange({ ...form, phone: event.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => onFormChange({ ...form, email: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_occasional}
            onChange={(event) => onFormChange({ ...form, is_occasional: event.target.checked })}
            className="rounded"
          />
          Cliente ocasional
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
