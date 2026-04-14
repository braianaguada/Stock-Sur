import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
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

type CustomerOption = {
  id: string;
  name: string;
};

type AvailableItemOption = {
  id: string;
  sku: string;
  name: string;
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
  onPriceListChange: (priceListId: string) => void;
  onAddItem: (itemId: string) => void;
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
  onPriceListChange,
  onAddItem,
  removeLine,
  onSubmit,
  onResetDraftForm,
  isSubmitting,
}: DocumentsEditorDialogProps) {
  const [itemSearch, setItemSearch] = useState("");

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
          onResetDraftForm();
        }
      }}
      title={editingDocId ? "Editar borrador" : "Nuevo documento"}
      contentClassName="max-h-[92vh] max-w-[min(96vw,1320px)] overflow-y-auto"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="space-y-5"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_320px]">
          <div className="rounded-xl border border-border/70 bg-card/60 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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

              <div className="space-y-2">
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

              <div className="space-y-2 xl:col-span-2">
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
                      <SelectItem value="INTERNO">Personal / tecnico interno</SelectItem>
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
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
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

              <div className="space-y-2">
                <Label>Nombre cliente</Label>
                <Input
                  value={form.customer_name}
                  placeholder="Opcional"
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
                <Label>Condicion fiscal</Label>
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
                <Label>Condicion de venta</Label>
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
                  <Label>Valido hasta</Label>
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
                <div className="space-y-2 xl:col-span-2">
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
                  <Label>Imputacion del remito</Label>
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
          </div>

          <div className="flex h-full flex-col justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                  Resumen
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  La carga de productos se hace siempre desde una lista activa.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-border/70 bg-background/70 p-3">
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Lista activa
                </div>
                <div className="text-sm font-medium">
                  {selectedPriceList?.name ?? "Selecciona una lista para continuar"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Lineas</div>
                  <div className="mt-1 text-2xl font-semibold">{lines.length}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                  <div className="mt-1 text-xl font-semibold">{formatMoney(totalDraft)}</div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Button type="submit" className="w-full" disabled={isSubmitting || priceLists.length === 0}>
                {isSubmitting ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
          <div className="flex flex-col gap-1">
            <Label>Agregar productos</Label>
            <p className="text-sm text-muted-foreground">
              Busca en la lista seleccionada y agrega o suma productos sin crear filas vacias.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
            <div className="space-y-3">
              <div className="relative">
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
                />
              </div>

              {itemSearch.trim().length > 0 ? (
                filteredItems.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-border/70 bg-background/70 p-2">
                    {filteredItems.map((item) => {
                      const alreadyAdded = lineCountByItemId.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {item.sku} | {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
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

            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                Productos cargados
              </div>
              <div className="mt-2 text-2xl font-semibold">{lines.length}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Cada producto agregado puede editar cantidad, modo de precio y eliminarse desde su fila.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                Todavia no agregaste productos al documento.
              </div>
            ) : null}

            {lines.map((line, index) => {
              const lockPrice = line.pricing_mode === "LIST_PRICE";
              const lineTotal = line.quantity * line.unit_price;

              return (
                <div key={`${line.item_id ?? "manual"}-${index}`} className="rounded-lg border border-border/70 bg-background/80 px-4 py-3">
                  <div className="grid gap-2 xl:grid-cols-[minmax(0,2.9fr)_110px_190px_130px_150px_128px_42px] xl:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {line.sku_snapshot ? `${line.sku_snapshot} | ` : ""}
                        {line.description}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Unidad: {line.unit || "un"} | Precio sugerido: {formatMoney(line.suggested_unit_price)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input
                        className="h-10 text-sm"
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: Number(event.target.value) || 0 })
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Modo de precio</Label>
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
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LIST_PRICE">{PRICING_MODE_LABEL.LIST_PRICE}</SelectItem>
                          <SelectItem value="MANUAL_MARGIN">{PRICING_MODE_LABEL.MANUAL_MARGIN}</SelectItem>
                          <SelectItem value="MANUAL_PRICE">{PRICING_MODE_LABEL.MANUAL_PRICE}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Margen %</Label>
                      <Input
                        className="h-10 text-sm"
                        type="number"
                        min={0}
                        step="any"
                        disabled={line.pricing_mode !== "MANUAL_MARGIN"}
                        placeholder="No aplica"
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

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Precio unitario</Label>
                      <Input
                        className="h-10 text-sm"
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

                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                      <div className="mt-0.5 text-base font-semibold">{formatMoney(lineTotal)}</div>
                    </div>

                    <div className="flex items-end justify-end xl:justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
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

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea
            value={form.notes}
            onChange={(event) =>
              setForm((previousForm) => ({ ...previousForm, notes: event.target.value }))
            }
          />
        </div>
      </form>
    </EntityDialog>
  );
}
