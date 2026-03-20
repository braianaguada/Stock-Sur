import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupplierFormState } from "@/features/suppliers/types";

export function SupplierFormDialog(props: {
  open: boolean;
  editingName?: string | null;
  form: SupplierFormState;
  showAdvanced: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onShowAdvancedChange: (open: boolean) => void;
  onFormChange: (form: SupplierFormState) => void;
  onSubmit: () => void;
}) {
  const {
    open,
    editingName,
    form,
    showAdvanced,
    isSaving,
    onOpenChange,
    onShowAdvancedChange,
    onFormChange,
    onSubmit,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingName ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>
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
          <div className="space-y-2">
            <Label>WhatsApp (opcional)</Label>
            <Input
              value={form.whatsapp}
              onChange={(event) => onFormChange({ ...form, whatsapp: event.target.value })}
              placeholder="2991234567 o +542991234567"
            />
          </div>
          <Collapsible open={showAdvanced} onOpenChange={onShowAdvancedChange}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="px-0 text-muted-foreground">
                Campos avanzados <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  value={form.contact_name}
                  onChange={(event) => onFormChange({ ...form, contact_name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => onFormChange({ ...form, email: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={form.notes}
                  onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
