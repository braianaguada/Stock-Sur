import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Technician } from "../types";

export type TechnicianFormState = {
  name: string;
  phone: string;
  notes: string;
};

type Props = {
  open: boolean;
  editingTechnician: Technician | null;
  form: TechnicianFormState;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: TechnicianFormState) => void;
  onSubmit: () => void;
};

export function TechnicianFormDialog({ open, editingTechnician, form, isSaving, onOpenChange, onFormChange, onSubmit }: Props) {
  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={editingTechnician ? "Editar tecnico" : "Nuevo tecnico"}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre *</Label>
          <Input value={form.name} onChange={(e) => onFormChange({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Telefono</Label>
          <Input value={form.phone} onChange={(e) => onFormChange({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Notas</Label>
          <Input value={form.notes} onChange={(e) => onFormChange({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    </EntityDialog>
  );
}

