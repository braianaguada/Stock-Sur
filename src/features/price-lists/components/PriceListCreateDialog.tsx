import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PriceListFormState } from "@/features/price-lists/types";

type PriceListCreateDialogProps = {
  open: boolean;
  form: PriceListFormState;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (updater: (prev: PriceListFormState) => PriceListFormState) => void;
  onSubmit: () => void;
};

export function PriceListCreateDialog({
  open,
  form,
  isSaving,
  onOpenChange,
  onFormChange,
  onSubmit,
}: PriceListCreateDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva lista"
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
          <Input value={form.name} onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Descripcion</Label>
          <Textarea value={form.description} onChange={(event) => onFormChange((prev) => ({ ...prev, description: event.target.value }))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Flete %</Label>
            <Input type="number" min={0} step="any" value={form.flete_pct} onChange={(event) => onFormChange((prev) => ({ ...prev, flete_pct: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Margen %</Label>
            <Input type="number" min={0} step="any" value={form.utilidad_pct} onChange={(event) => onFormChange((prev) => ({ ...prev, utilidad_pct: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>IVA %</Label>
            <Input type="number" min={0} step="any" value={form.impuesto_pct} onChange={(event) => onFormChange((prev) => ({ ...prev, impuesto_pct: event.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Guardando..." : "Crear lista"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
