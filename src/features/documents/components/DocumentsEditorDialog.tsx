import { useMemo, useState } from "react";
import { Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRICING_MODE_LABEL } from "@/features/documents/constants";
import { buildItemDisplayMeta, buildItemDisplayName } from "@/lib/item-display";
import { formatMoney } from "@/lib/formatters";
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

type CustomerOption = {
  id: string;
  name: string;
};

type AvailableItemOption = {
  id: string;
  sku: string;
  name: string;
  unit?: string | null;
  attributes?: string | null;
  brand?: string | null;
  model?: string | null;
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
  onAddItem: (itemId: string) => void;
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
  onAddItem,
  removeLine,
  onSubmit,
  onResetDraftForm,
  isSubmitting,
}: DocumentsEditorDialogProps) {
  const [itemSearch, setItemSearch] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const selectedPriceList = useMemo(
    () => priceLists.find((priceList) => priceList.id === form.price_list_id) ?? null,
    [form.price_list_id, priceLists],
  );

  const lineCountByItemId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) {
      if (!line.item_id) continue;
      counts.set(line.item_id, (counts.get(line.item_id) ?? 0) + 1);
    }
    return counts;
  }, [lines]);

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!form.price_list_id || query.length === 0) return [];

    return availableItems
      .filter((item) =>
        [item.sku, item.name, item.unit ?? ""].some((value) => value.toLowerCase().includes(query)),
      )
      .slice(0, 8);
  }, [availableItems, form.price_list_id, itemSearch]);

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((previousLines) =>
      previousLines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };

  const handleAddItem = (itemId: string) => {
    onAddItem(itemId);
    setItemSearch("");
  };

  return (
    <EntityDialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setItemSearch("");
          setDetailsOpen(false);
          onResetDraftForm();
        }
      }}
      title={editingDocId ? "Editar borrador" : "Nuevo documento"}
      contentClassName="!w-[min(98vw,1680px)] sm:!w-[min(98vw,1680px)] !max-w-[1680px] sm:!max-w-[1680px] max-h-[92vh] overflow-x-hidden overflow-y-auto"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <Card className="border-border/70 bg-card/60 shadow-sm">
          <CardContent className="p-0">
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <div className="p-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-start">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={form.doc_type}
                  onValueChange={(value) =>
                    setForm((previousForm) => {
                      const nextDocType = value as DocType;
                      const nextCustomerKind =
                        nextDocType === "PRESUPUESTO" && previousForm.customer_kind === "INTERNO"
                          ? "GENERAL"
                          : previousForm.customer_kind;
                      return {
                        ...previousForm,
                        doc_type: nextDocType,
                        customer_kind: nextCustomerKind,
                        internal_remito_type:
                          nextDocType === "REMITO" && nextCustomerKind === "INTERNO"
                            ? previousForm.internal_remito_type
                            : "",
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

              <div className="space-y-2 lg:hidden xl:block">
                <Label>Punto de venta</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.point_of_sale}
                  onChange={(event) =>
                    setForm((previousForm) => ({
                      ...previousForm,
                      point_of_sale: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2 xl:col-span-1">
                <Label>Lista de precios *</Label>
                <Select value={form.price_list_id} onValueChange={onPriceListChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar lista" />
                  </SelectTrigger>
                  <SelectContent>
                    {priceLists.map((priceList) => (
                      <SelectItem key={priceList.id} value={priceList.id}>
                        {priceList.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end h-full w-full">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-9 mt-6 w-full shadow-none bg-background/50 hover:bg-background">
                    {detailsOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    {detailsOpen ? "Ocultar opciones avanzadas" : "Opciones de documento"}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent className="px-4 pb-4 border-t border-border/60 bg-muted/10 pt-4 rounded-b-xl">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 hidden lg:block xl:hidden">
                  <Label>Punto de venta</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.point_of_sale}
                    onChange={(event) =>
                      setForm((previousForm) => ({
                        ...previousForm,
                        point_of_sale: Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={form.customer_kind}
                    onValueChange={(value) =>
                      setForm((previousForm) => ({
                        ...previousForm,
                        customer_kind: value as CustomerKind,
                        internal_remito_type:
                          value === "INTERNO" && previousForm.doc_type === "REMITO"
                            ? previousForm.internal_remito_type
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">Cliente general</SelectItem>
                      {form.doc_type === "REMITO" ? (
                          <SelectItem value="INTERNO">Personal / tÃ©cnico interno</SelectItem>
                      ) : null}
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cliente registrado</Label>
                  <Select
                    value={form.customer_id || "__none__"}
                    onValueChange={(value) =>
                      setForm((previousForm) => ({
                        ...previousForm,
                        customer_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Cliente ocasional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin seleccionar</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Nombre cliente</Label>
                  <Input
                    value={form.customer_name}
                    placeholder="Cliente ocasional"
                    onChange={(event) =>
                      setForm((previousForm) => ({ ...previousForm, customer_name: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>CUIT</Label>
                  <Input
                    value={form.customer_tax_id}
                    placeholder="Opcional"
                    onChange={(event) =>
                      setForm((previousForm) => ({ ...previousForm, customer_tax_id: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>CondiciÃ³n fiscal</Label>
                  <Input
                    value={form.customer_tax_condition}
                    placeholder="Opcional"
                    onChange={(event) =>
                      setForm((previousForm) => ({
                        ...previousForm,
                        customer_tax_condition: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>CondiciÃ³n de venta</Label>
                  <Input
                    value={form.payment_terms}
                    placeholder="Opcional"
                    onChange={(event) =>
                      setForm((previousForm) => ({ ...previousForm, payment_terms: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Input
                    value={form.salesperson}
                    placeholder="Opcional"
                    onChange={(event) =>
                      setForm((previousForm) => ({ ...previousForm, salesperson: event.target.value }))
                    }
                  />
                </div>

                {form.doc_type === "PRESUPUESTO" ? (
                  <div className="space-y-2">
                    <Label>VÃ¡lido hasta</Label>
                    <Input
                      type="date"
                      value={form.valid_until}
                      onChange={(event) =>
                        setForm((previousForm) => ({ ...previousForm, valid_until: event.target.value }))
                      }
                    />
                  </div>
                ) : null}

                {form.doc_type === "REMITO" ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Domicilio de entrega</Label>
                    <Input
                      value={form.delivery_address}
                      placeholder="Opcional"
                      onChange={(event) =>
                        setForm((previousForm) => ({ ...previousForm, delivery_address: event.target.value }))
                      }
                    />
                  </div>
                ) : null}

                {form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? (
                  <div className="space-y-2">
                    <Label>ImputaciÃ³n del remito</Label>
                    <Select
                      value={form.internal_remito_type || "__none__"}
                      onValueChange={(value) =>
                        setForm((previousForm) => ({
                          ...previousForm,
                          internal_remito_type:
                            value === "__none__" ? "" : (value as InternalRemitoType),
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                        <SelectItem value="DESCUENTO_SUELDO">Descuento de sueldo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
          </CardContent>
        </Card>

        <div className="space-y-4 rounded-xl border border-border/70 bg-card/60 p-4 relative">
          <div className="flex flex-col gap-1">
            <Label className="text-base">Productos ({lines.length})</Label>
            <p className="text-sm text-muted-foreground mr-[200px]">
              Busca en la lista activa ({selectedPriceList?.name ?? "Ninguna"}) y agrega productos. 
              <span className="hidden sm:inline"> Presiona <strong>Enter</strong> para sumar rÃ¡pidamente el primero.</span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                  value={itemSearch}
                  disabled={!form.price_list_id || priceLists.length === 0}
                  className="pl-10"
                  placeholder={
                    form.price_list_id
                      ? "Buscar producto por SKU, nombre o unidad"
                      : "Selecciona una lista para habilitar la busqueda"
                  }
                  onChange={(event) => setItemSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredItems.length > 0) {
                      event.preventDefault();
                      handleAddItem(filteredItems[0].id);
                    }
                  }}
                />
            </div>

            {itemSearch.trim().length > 0 ? (
              filteredItems.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-2">
                  {filteredItems.map((item) => {
                    const alreadyAdded = lineCountByItemId.has(item.id);
                    const displayName = buildItemDisplayName(item);
                    const displayMeta = buildItemDisplayMeta(item);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium leading-5 break-words">
                            {displayName}
                          </div>
                          <div className="text-xs text-muted-foreground break-words">
                            {displayMeta ? `${displayMeta} - ` : ""}
                            Unidad: {item.unit || "un"}
                            {alreadyAdded ? " | Ya agregado" : ""}
                          </div>
                        </div>
                        <Button type="button" size="sm" onClick={() => handleAddItem(item.id)}>
                          {alreadyAdded ? "Sumar" : "Agregar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                  No hay coincidencias en la lista seleccionada.
                </div>
              )
            ) : null}
          </div>

          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground bg-muted/10">
                <Search className="h-8 w-8 mb-3 text-muted-foreground/30" />
                No tienes ningÃºn producto agregado.
                <br />
                Usa el buscador para aÃ±adirlos.
              </div>
            ) : (
              <div className="sticky top-0 z-20 hidden rounded-md border border-border/40 bg-muted/70 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur-md xl:grid xl:grid-cols-[minmax(0,2.9fr)_100px_160px_120px_140px_128px_42px] xl:gap-3">
                <div>Producto</div>
                <div>Cantidad</div>
                <div>Modo de precio</div>
                <div>Margen %</div>
                <div>Precio unitario</div>
                <div>Total</div>
                <div className="text-right">Acs</div>
              </div>
            )}

            {lines.map((line, index) => {
              const lockPrice = line.pricing_mode === "LIST_PRICE";
              const lineTotal = line.quantity * line.unit_price;

              return (
                <div key={`${line.item_id ?? "manual"}-${index}`} className="group rounded-lg border border-border/70 bg-background/80 px-3 py-2 hover:border-border transition-colors">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,2.9fr)_100px_160px_120px_140px_128px_42px] xl:items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground leading-5 break-words">
                        {line.sku_snapshot ? `${line.sku_snapshot} | ` : ""}
                        {line.description}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{line.unit || "un"}</span>
                        <span className="hidden sm:inline">&bull;</span>
                        <span>Sug: {formatMoney(line.suggested_unit_price)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 xl:space-y-0">
                      <Label className="text-xs text-muted-foreground xl:hidden">Cantidad</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: Number(event.target.value) || 0 })
                        }
                      />
                    </div>

                    <div className="space-y-1 xl:space-y-0">
                      <Label className="text-xs text-muted-foreground xl:hidden">Modo de precio</Label>
                      <Select
                        value={line.pricing_mode}
                        onValueChange={(value) => {
                          const nextMode = value as LinePricingMode;
                          if (nextMode === "LIST_PRICE") {
                            updateLine(index, {
                              pricing_mode: nextMode,
                              unit_price: line.suggested_unit_price,
                              manual_margin_pct: null,
                              price_overridden_at: null,
                              price_overridden_by: null,
                            });
                            return;
                          }

                          if (nextMode === "MANUAL_MARGIN") {
                            const marginPct =
                              line.manual_margin_pct ?? line.list_utilidad_pct_snapshot ?? 0;
                            updateLine(index, {
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
                            return;
                          }

                          updateLine(index, {
                            pricing_mode: nextMode,
                            price_overridden_at: new Date().toISOString(),
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LIST_PRICE">{PRICING_MODE_LABEL.LIST_PRICE}</SelectItem>
                          <SelectItem value="MANUAL_MARGIN">{PRICING_MODE_LABEL.MANUAL_MARGIN}</SelectItem>
                          <SelectItem value="MANUAL_PRICE">{PRICING_MODE_LABEL.MANUAL_PRICE}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 xl:space-y-0">
                      <Label className="text-xs text-muted-foreground xl:hidden">Margen %</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        min={0}
                        step="any"
                        disabled={line.pricing_mode !== "MANUAL_MARGIN"}
                        placeholder="N/A"
                        value={line.pricing_mode === "MANUAL_MARGIN" ? (line.manual_margin_pct ?? "") : ""}
                        onChange={(event) => {
                          const marginPct = event.target.value === "" ? 0 : Number(event.target.value);
                          updateLine(index, {
                            manual_margin_pct: marginPct,
                            unit_price: calculatePriceFromCostBase(
                              line.base_cost_snapshot ?? 0,
                              line.list_flete_pct_snapshot,
                              marginPct,
                              line.list_impuesto_pct_snapshot,
                            ),
                            price_overridden_at: new Date().toISOString(),
                          });
                        }}
                      />
                    </div>

                    <div className="space-y-1 xl:space-y-0">
                      <Label className="text-xs text-muted-foreground xl:hidden">Precio unitario</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number"
                        min={0}
                        step="any"
                        disabled={lockPrice}
                        value={line.unit_price}
                        onChange={(event) =>
                          updateLine(index, {
                            unit_price: Number(event.target.value) || 0,
                            price_overridden_at: new Date().toISOString(),
                          })
                        }
                      />
                    </div>

                    <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-1 flex items-center min-h-9 mt-4 xl:mt-0 relative overflow-hidden">
                      <Label className="text-xs text-muted-foreground xl:hidden absolute top-0 -mt-5">Total</Label>
                      <div className="text-sm font-semibold text-foreground w-full xl:text-left whitespace-nowrap">{formatMoney(lineTotal)}</div>
                    </div>

                    <div className="flex items-end justify-end xl:justify-center mt-[-36px] xl:mt-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => removeLine(index)}
                        title="Eliminar linea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 mb-20">
          <Label>Notas Generales</Label>
          <Textarea
            className="resize-none min-h-[80px]"
            placeholder="Aclaraciones adicionales del documento..."
            value={form.notes}
            onChange={(event) =>
              setForm((previousForm) => ({ ...previousForm, notes: event.target.value }))
            }
          />
        </div>

        <div className="sticky bottom-0 z-30 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/95 px-5 py-4 shadow-[var(--shadow-md)] backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-0.5">Total Documento</span>
            <span className="text-2xl font-extrabold tracking-tight text-foreground">
              {formatMoney(totalDraft)}
            </span>
          </div>
          <Button type="submit" disabled={isSubmitting || priceLists.length === 0} className="h-11 rounded-full px-8 shadow-sm">
            {isSubmitting ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
          </Button>
        </div>
      </form>
    </EntityDialog>
  );
}

