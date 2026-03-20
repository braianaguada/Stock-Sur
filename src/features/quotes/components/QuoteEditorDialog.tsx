import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X } from "lucide-react";
import type { QuoteFormState, QuoteLine } from "@/features/quotes/types";

interface QuoteEditorDialogProps {
  customers: Array<{ id: string; name: string }>;
  form: QuoteFormState;
  isSaving: boolean;
  lines: QuoteLine[];
  open: boolean;
  onAddLine: () => void;
  onFormChange: (form: QuoteFormState) => void;
  onLineChange: (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveLine: (index: number) => void;
  onSubmit: () => void;
}

export function QuoteEditorDialog({
  customers,
  form,
  isSaving,
  lines,
  open,
  onAddLine,
  onFormChange,
  onLineChange,
  onOpenChange,
  onRemoveLine,
  onSubmit,
}: QuoteEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle>Nuevo presupuesto</DialogTitle></DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente registrado</Label>
              <Select value={form.customer_id} onValueChange={(value) => onFormChange({ ...form, customer_id: value === "__none__" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin seleccionar</SelectItem>
                  {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre cliente</Label>
              <Input value={form.customer_name} onChange={(event) => onFormChange({ ...form, customer_name: event.target.value })} placeholder="O escribí un nombre" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Líneas</Label>
              <Button type="button" variant="outline" size="sm" onClick={onAddLine}><Plus className="mr-1 h-3 w-3" /> Línea</Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input className="flex-1" placeholder="Descripción" value={line.description} onChange={(event) => onLineChange(index, "description", event.target.value)} />
                  <Input className="w-20" type="number" step="any" placeholder="Cant." value={line.quantity} onChange={(event) => onLineChange(index, "quantity", parseFloat(event.target.value) || 0)} />
                  <Input className="w-28" type="number" step="any" placeholder="Precio" value={line.unit_price} onChange={(event) => onLineChange(index, "unit_price", parseFloat(event.target.value) || 0)} />
                  <span className="w-24 pt-2 text-right text-sm text-muted-foreground">
                    ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                  {lines.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onRemoveLine(index)}><X className="h-3 w-3" /></Button>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-right font-bold">
              Total: ${lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Crear presupuesto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
