import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_LINE } from "@/features/documents/constants";
import type {
  CustomerKind,
  DocType,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
  PriceListRow,
} from "@/features/documents/types";

type CustomerOption = {
  id: string;
  name: string;
};

type AvailableItemOption = {
  id: string;
  sku: string;
  name: string;
};

interface DocumentsEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDocId: string | null;
  form: DocumentFormState;
  setForm: React.Dispatch<React.SetStateAction<DocumentFormState>>;
  lines: LineDraft[];
  setLines: React.Dispatch<React.SetStateAction<LineDraft[]>>;
  totalDraft: number;
  customers: CustomerOption[];
  priceLists: PriceListRow[];
  availableItems: AvailableItemOption[];
  onPriceListChange: (priceListId: string) => void;
  onPickItem: (idx: number, itemId: string) => void;
  removeLine: (idx: number) => void;
  onSubmit: () => void;
  onResetDraftForm: () => void;
  isSubmitting: boolean;
}

export function DocumentsEditorDialog({
  open,
  onOpenChange,
  editingDocId,
  form,
  setForm,
  lines,
  setLines,
  totalDraft,
  customers,
  priceLists,
  availableItems,
  onPriceListChange,
  onPickItem,
  removeLine,
  onSubmit,
  onResetDraftForm,
  isSubmitting,
}: DocumentsEditorDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onResetDraftForm();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editingDocId ? "Editar borrador" : "Nuevo documento"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.doc_type}
                onValueChange={(v) =>
                  setForm((prev) => {
                    const nextDocType = v as DocType;
                    const nextCustomerKind = nextDocType === "PRESUPUESTO" && prev.customer_kind === "INTERNO" ? "GENERAL" : prev.customer_kind;
                    return {
                      ...prev,
                      doc_type: nextDocType,
                      customer_kind: nextCustomerKind,
                      internal_remito_type: nextDocType === "REMITO" && nextCustomerKind === "INTERNO" ? prev.internal_remito_type : "",
                    };
                  })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESUPUESTO">Presupuesto</SelectItem>
                  <SelectItem value="REMITO">Remito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Punto de venta</Label>
              <Input type="number" min={1} value={form.point_of_sale} onChange={(e) => setForm((prev) => ({ ...prev, point_of_sale: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div className="space-y-2">
              <Label>Lista de precios</Label>
              <Select value={form.price_list_id || "__none__"} onValueChange={(v) => onPriceListChange(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin lista</SelectItem>
                  {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select
                value={form.customer_kind}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    customer_kind: v as CustomerKind,
                    internal_remito_type: v === "INTERNO" && prev.doc_type === "REMITO" ? prev.internal_remito_type : "",
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">Cliente general</SelectItem>
                  {form.doc_type === "REMITO" && <SelectItem value="INTERNO">Personal / tecnico interno</SelectItem>}
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente registrado</Label>
              <Select value={form.customer_id || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, customer_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin seleccionar</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre cliente</Label>
              <Input value={form.customer_name} onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input value={form.customer_tax_id} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_id: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Condicion fiscal</Label>
              <Input value={form.customer_tax_condition} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_condition: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Condicion de venta</Label>
              <Input value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Input value={form.salesperson} onChange={(e) => setForm((prev) => ({ ...prev, salesperson: e.target.value }))} />
            </div>
            {form.doc_type === "PRESUPUESTO" && (
              <div className="space-y-2">
                <Label>Valido hasta</Label>
                <Input type="date" value={form.valid_until} onChange={(e) => setForm((prev) => ({ ...prev, valid_until: e.target.value }))} />
              </div>
            )}
          </div>

          {form.doc_type === "REMITO" && (
            <div className="space-y-2">
              <Label>Domicilio de entrega</Label>
              <Input value={form.delivery_address} onChange={(e) => setForm((prev) => ({ ...prev, delivery_address: e.target.value }))} />
            </div>
          )}

          {form.doc_type === "REMITO" && form.customer_kind === "INTERNO" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Imputacion del remito</Label>
                <Select
                  value={form.internal_remito_type || "__none__"}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, internal_remito_type: v === "__none__" ? "" : (v as InternalRemitoType) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                    <SelectItem value="DESCUENTO_SUELDO">Descuento de sueldo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Lineas</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, EMPTY_LINE])}>
                <Plus className="mr-1 h-3 w-3" /> Linea
              </Button>
            </div>
            {form.price_list_id && (
              <p className="text-xs text-muted-foreground">Con lista activa, solo aparecen items de esa lista y el precio unitario se toma automaticamente.</p>
            )}
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const lockPrice = !!form.price_list_id && !!line.item_id;
                const lockDescription = !!line.item_id;
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <div className="col-span-3">
                      <Select value={line.item_id ?? "__none__"} onValueChange={(v) => onPickItem(idx, v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                        <SelectContent>
                          {!form.price_list_id && <SelectItem value="__none__">Manual</SelectItem>}
                          {availableItems.map((it) => <SelectItem key={it.id} value={it.id}>{it.sku} - {it.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="col-span-4"
                      placeholder="Descripcion"
                      value={line.description}
                      disabled={lockDescription}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setLines(next);
                      }}
                    />
                    <Input
                      className="col-span-1"
                      type="number"
                      min={0.001}
                      step="any"
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                        setLines(next);
                      }}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      min={0}
                      step="any"
                      value={line.unit_price}
                      disabled={lockPrice}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 };
                        setLines(next);
                      }}
                    />
                    <div className="col-span-2 flex items-center justify-end text-sm font-mono">
                      ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-12 flex justify-end md:col-span-12">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(idx)}
                        title="Eliminar linea"
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Eliminar linea
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-right font-bold">Total: ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
