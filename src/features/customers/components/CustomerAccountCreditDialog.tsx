import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "../types";

export type CustomerAccountCreditFormState = {
  amount: string;
  business_date: string;
  description: string;
  notes: string;
};

type Props = {
  open: boolean;
  customer: Customer | null;
  form: CustomerAccountCreditFormState;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: CustomerAccountCreditFormState) => void;
  onSubmit: () => void;
};

export function CustomerAccountCreditDialog({ open, customer, form, isSaving, onOpenChange, onFormChange, onSubmit }: Props) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? `Registrar cobro · ${customer.name}` : "Registrar cobro"}
      contentClassName="sm:max-w-xl"
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Importe *</Label>
            <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => onFormChange({ ...form, amount: event.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Fecha operativa *</Label>
            <Input type="date" value={form.business_date} onChange={(event) => onFormChange({ ...form, business_date: event.target.value })} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Descripcion *</Label>
          <Input value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} rows={4} />
        </div>
        <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
          El cobro queda trazado como movimiento CREDIT manual.
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Registrar cobro"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
