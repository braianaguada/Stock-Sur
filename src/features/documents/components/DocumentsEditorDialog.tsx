import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRICING_MODE_LABEL } from "@/features/documents/constants";
import type {
  CustomerKind,
  DocType,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
  LinePricingMode,
  PriceListRow,
} from "@/features/documents/types";
import { calculatePriceFromCostBase } from "@/features/documents/utils";
import { buildItemDisplayName } from "@/lib/item-display";

type CustomerOption = {
  id: string;
  name: string;
};

type AvailableItemOption = {
  id: string;
  sku: string;
  name: string;
  attributes?: string | null;
  brand?: string | null;
  model?: string | null;
  display_name?: string;
  unit?: string | null;
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
  onAddItem: (itemId: string) => void;
  onPriceListChange: (priceListId: string) => void;
  onPickItem: (index: number, itemId: string) => void;
  removeLine: (idx: number) => void;
  onSubmit: () => void;
  onResetDraftForm: () => void;
  isSubmitting: boolean;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
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
  onAddItem,
  onPriceListChange,
  onPickItem,
  removeLine,
  onSubmit,
  onResetDraftForm,
  isSubmitting,
}: DocumentsEditorDialogProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const deferredItemQuery = useDeferredValue(itemQuery);

  const hasPriceList = Boolean(form.price_list_id);

  const filteredItems = useMemo(() => {
    if (!deferredItemQuery.trim()) return [];
    const query = deferredItemQuery.toLowerCase();
    return availableItems.filter((item) => {
      const display = buildItemDisplayName({
        name: item.name,
        brand: item.brand,
        model: item.model,
        attributes: item.attributes,
      }).toLowerCase();
      return (
        item.sku.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        display.includes(query)
      );
    }).slice(0, 10);
  }, [deferredItemQuery, availableItems]);

  const handleAddItem = (itemId: string) => {
    onAddItem(itemId);
    setItemQuery("");
  };

  const updateLine = (idx: number, updates: Partial<LineDraft>) => {
    const next = [...lines];
    next[idx] = { ...next[idx], ...updates };
    setLines(next);
  };

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editingDocId ? "Editar Documento" : "Nuevo Documento"}
      description="Completa los datos del cliente y los productos. El documento se guardará como borrador."
      size="xl"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-6"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Datos del Documento</div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={form.customer_id ?? ""}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, customer_id: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lista de precios</Label>
                <Select value={form.price_list_id ?? "none"} onValueChange={onPriceListChange}>
                  <SelectTrigger><SelectValue placeholder="Precio manual (sin lista)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual (Sin lista)</SelectItem>
                    {priceLists.map((pl) => (
                      <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="rounded-xl border border-border/70 bg-background/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Mas detalles</div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Observaciones internas o para el cliente..."
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agregar productos
              </Label>
              <Input
                placeholder="Buscar por SKU o nombre..."
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
              />
              {filteredItems.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[300px] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl backdrop-blur-md overflow-hidden">
                  {filteredItems.map((item) => {
                    const alreadyAdded = lines.some((l) => l.item_id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-md p-2 hover:bg-muted/60 transition-colors"
                      >
                        <div className="min-w-0 pr-4">
                          <p className="truncate text-sm font-medium">{item.sku} | {item.name}</p>
                          <p className="text-[11px] text-muted-foreground">Unidad: {item.unit || "un"}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleAddItem(item.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {alreadyAdded ? "Sumar" : "Agregar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : itemQuery.length > 2 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover p-3 text-center text-sm text-muted-foreground shadow-xl">
                  No se encontraron productos
                </div>
              ) : null}
            </div>
            
            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-3 shadow-[inset_0_1px_rgba(255,255,255,0.1)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-bold mb-0.5">Total Documento</p>
              <p className="text-2xl font-black tracking-tight text-primary">
                ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-12">
                <Plus className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Agrega productos para comenzar</p>
              </div>
            ) : (
              lines.map((line, idx) => {
                const lineHasPriceList = Boolean(line.item_id && form.price_list_id);
                const lockPrice = line.pricing_mode === "LIST_PRICE";

                return (
                  <div key={`${line.item_id ?? "manual"}-${idx}`} className="group relative rounded-2xl border border-border/50 bg-card py-3 px-4 shadow-sm transition-all hover:bg-card/80 hover:shadow-md">
                    <div className="grid gap-4 md:grid-cols-[2fr_100px_150px_180px_150px_40px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground/90">
                          {line.sku_snapshot ? `${line.sku_snapshot} | ` : ""}{line.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Unidad: {line.unit || "un"}</p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cant.</Label>
                        <Input
                          className="h-9 text-center font-mono"
                          type="number"
                          min={0}
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">P. Unitario</Label>
                        <Input
                          className="h-9 text-right font-mono"
                          type="number"
                          min={0}
                          step="any"
                          value={line.unit_price}
                          disabled={lockPrice}
                          onChange={(e) => updateLine(idx, { 
                            unit_price: Number(e.target.value) || 0,
                            price_overridden_at: lineHasPriceList ? new Date().toISOString() : line.price_overridden_at
                          })}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Modo de precio</Label>
                        {lineHasPriceList ? (
                          <Select
                            value={line.pricing_mode}
                            onValueChange={(value) => {
                              const nextMode = value as LinePricingMode;
                              if (nextMode === "LIST_PRICE") {
                                updateLine(idx, {
                                  pricing_mode: nextMode,
                                  unit_price: line.suggested_unit_price,
                                  manual_margin_pct: null,
                                  price_overridden_at: null,
                                  price_overridden_by: null,
                                });
                              } else if (nextMode === "MANUAL_MARGIN") {
                                const marginPct = line.manual_margin_pct ?? line.list_utilidad_pct_snapshot ?? 0;
                                updateLine(idx, {
                                  pricing_mode: nextMode,
                                  manual_margin_pct: Number(marginPct),
                                  unit_price: calculatePriceFromCostBase(
                                    line.base_cost_snapshot ?? 0,
                                    line.list_flete_pct_snapshot,
                                    Number(marginPct),
                                    line.list_impuesto_pct_snapshot,
                                  ),
                                  price_overridden_at: new Date().toISOString(),
                                });
                              } else {
                                updateLine(idx, {
                                  pricing_mode: nextMode,
                                  price_overridden_at: new Date().toISOString(),
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LIST_PRICE">{PRICING_MODE_LABEL.LIST_PRICE}</SelectItem>
                              <SelectItem value="MANUAL_MARGIN">{PRICING_MODE_LABEL.MANUAL_MARGIN}</SelectItem>
                              <SelectItem value="MANUAL_PRICE">{PRICING_MODE_LABEL.MANUAL_PRICE}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-9 flex items-center px-3 border border-dashed rounded-md text-[11px] text-muted-foreground bg-muted/10 font-medium">Manual (Sin lista)</div>
                        )}
                      </div>

                      <div className="text-right">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Total Linea</Label>
                        <p className="text-base font-bold tabular-nums">${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeLine(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-[calc(var(--radius)+0.15rem)] border border-border/60 bg-background/85 px-6 py-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] backdrop-blur-sm">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Resumen Documento</p>
            <p className="text-xl font-black tracking-tight text-foreground">
              ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <Button type="submit" disabled={isSubmitting} className="h-11 rounded-full px-8 font-bold shadow-lg shadow-primary/20">
            {isSubmitting ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}
