<<<<<<< HEAD
import { useDeferredValue, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
=======
import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
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

type CustomerOption = {
  id: string;
  name: string;
};

type AvailableItemOption = {
  id: string;
  sku: string;
  name: string;
<<<<<<< HEAD
  attributes?: string | null;
  brand?: string | null;
  model?: string | null;
  display_name?: string;
=======
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
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
  onAddItem,
  onPriceListChange,
<<<<<<< HEAD
  onPickItem: _onPickItem,
=======
  onAddItem,
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
  removeLine,
  onSubmit,
  onResetDraftForm,
  isSubmitting,
}: DocumentsEditorDialogProps) {
<<<<<<< HEAD
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const deferredItemQuery = useDeferredValue(itemQuery);

  const hasPriceList = Boolean(form.price_list_id);
  const hasNotes = form.notes.trim().length > 0;
  const customerLabel = useMemo(() => {
    const selected = form.customer_id ? customers.find((c) => c.id === form.customer_id) : null;
    return selected?.name ?? form.customer_name.trim() ?? "";
  }, [customers, form.customer_id, form.customer_name]);

  const filteredItems = useMemo(() => {
    const needle = deferredItemQuery.trim().toLowerCase();
    if (!needle) return [];
    return availableItems
      .filter((item) => {
        const haystacks = [
          item.display_name ?? item.name,
          item.sku,
          item.brand,
          item.model,
          item.attributes,
        ];
        return haystacks.some((value) => value?.toLowerCase().includes(needle));
      })
      .slice(0, 12);
  }, [availableItems, deferredItemQuery]);

  const availableItemsById = useMemo(
    () => new Map(availableItems.map((item) => [item.id, item])),
    [availableItems],
  );

  const addItemFromSearch = (itemId: string) => {
    onAddItem(itemId);
    setItemQuery("");
  };
=======
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

>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
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
<<<<<<< HEAD
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <Collapsible
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            className="rounded-[calc(var(--radius)+0.15rem)] border border-border/60 bg-card/70 shadow-[var(--shadow-xs)]"
          >
            <div className="p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo *</Label>
                  <Select
                    value={form.doc_type}
                    onValueChange={(v) =>
                      setForm((prev) => {
                        const nextDocType = v as DocType;
                        const nextCustomerKind =
                          nextDocType === "PRESUPUESTO" && prev.customer_kind === "INTERNO" ? "GENERAL" : prev.customer_kind;
                        return {
                          ...prev,
                          doc_type: nextDocType,
                          customer_kind: nextCustomerKind,
                          internal_remito_type:
                            nextDocType === "REMITO" && nextCustomerKind === "INTERNO" ? prev.internal_remito_type : "",
                        };
                      })
                    }
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRESUPUESTO">Presupuesto</SelectItem>
                      <SelectItem value="REMITO">Remito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Punto de venta</Label>
                  <Input
                    className="h-9"
                    type="number"
                    min={1}
                    value={form.point_of_sale}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, point_of_sale: Math.max(1, Number(e.target.value) || 1) }))
                    }
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Lista de precios</Label>
                  <Select
                    value={form.price_list_id || "__none__"}
                    onValueChange={(v) => onPriceListChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin lista</SelectItem>
                      {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <Select
                    value={form.customer_id || "__none__"}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, customer_id: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin seleccionar</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-12">
                <div className="md:col-span-3 space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo de cliente</Label>
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
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">Cliente general</SelectItem>
                      {form.doc_type === "REMITO" && <SelectItem value="INTERNO">Personal / tecnico interno</SelectItem>}
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-6 space-y-1">
                  <Label className="text-xs text-muted-foreground">Nombre cliente</Label>
                  <Input
                    className="h-9"
                    value={form.customer_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Opcional"
                  />
                </div>

                <div className="md:col-span-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumen</p>
                    <p className="truncate text-sm font-semibold text-foreground">{customerLabel || "Sin cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {hasPriceList ? "Lista activa" : "Precio manual"}{hasNotes ? " · Con notas" : ""}
                    </p>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-full">
                      {detailsOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                      Mas datos
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
            </div>

            <CollapsibleContent className="border-t border-border/60 bg-background/40 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">CUIT</Label>
                  <Input className="h-9" value={form.customer_tax_id} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_id: e.target.value }))} />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Condicion fiscal</Label>
                  <Input className="h-9" value={form.customer_tax_condition} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_condition: e.target.value }))} />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Condicion de venta</Label>
                  <Input className="h-9" value={form.payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, payment_terms: e.target.value }))} />
                </div>
                <div className="md:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Vendedor</Label>
                  <Input className="h-9" value={form.salesperson} onChange={(e) => setForm((prev) => ({ ...prev, salesperson: e.target.value }))} />
                </div>
                {form.doc_type === "PRESUPUESTO" ? (
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-xs text-muted-foreground">Valido hasta</Label>
                    <Input
                      className="h-9 w-full min-w-[11rem]"
                      type="date"
                      value={form.valid_until}
                      onChange={(e) => setForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                    />
                  </div>
                ) : null}
                {form.doc_type === "REMITO" ? (
                  <div className="md:col-span-8 space-y-1">
                    <Label className="text-xs text-muted-foreground">Domicilio de entrega</Label>
                    <Input className="h-9" value={form.delivery_address} onChange={(e) => setForm((prev) => ({ ...prev, delivery_address: e.target.value }))} />
                  </div>
                ) : null}
                {form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? (
                  <div className="md:col-span-4 space-y-1">
                    <Label className="text-xs text-muted-foreground">Imputacion del remito</Label>
                    <Select
                      value={form.internal_remito_type || "__none__"}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, internal_remito_type: v === "__none__" ? "" : (v as InternalRemitoType) }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                        <SelectItem value="DESCUENTO_SUELDO">Descuento de sueldo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="md:col-span-12 space-y-1">
                  <Label className="text-xs text-muted-foreground">Notas</Label>
                  <Textarea
                    className="min-h-[90px]"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-[calc(var(--radius)+0.15rem)] border border-border/60 bg-background/80 px-3 py-2 shadow-[var(--shadow-xs)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
                <div className="min-w-0">
                  <Label className="text-sm">Lineas</Label>
                  <p className="text-xs text-muted-foreground">
                    {hasPriceList ? "Precio por lista (editable por linea)" : "Precio manual por linea"}
                  </p>
                </div>

                <div className="relative w-full md:max-w-[560px]">
                  <Input
                    className="h-9"
                    placeholder={availableItems.length ? "Buscar producto (SKU / nombre / marca / modelo / atributo)" : "Sin productos"}
                    value={itemQuery}
                    disabled={availableItems.length === 0}
                    onChange={(e) => setItemQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setItemQuery("");
                        return;
                      }
                      if (e.key !== "Enter") return;
                      if (filteredItems.length === 0) return;
                      e.preventDefault();
                      addItemFromSearch(filteredItems[0].id);
                    }}
                  />

                  {itemQuery.trim() ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-auto rounded-md border border-border/70 bg-popover p-1 shadow-[var(--shadow-lg)]">
                      {filteredItems.length > 0 ? (
                        filteredItems.map((item) => {
                          const meta = [item.sku, item.brand, item.model, item.attributes].filter(Boolean).join(" | ");
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="w-full rounded-sm px-2 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                addItemFromSearch(item.id);
                              }}
                              title={meta ? `${item.display_name ?? item.name} (${meta})` : item.display_name ?? item.name}
                            >
                              <div className="truncate text-sm font-medium">
                                {item.display_name ?? item.name}
                              </div>
                              {meta ? (
                                <div className="truncate text-xs text-muted-foreground">
                                  {meta}
                                </div>
                              ) : null}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-2 py-2 text-xs text-muted-foreground">
                          Sin resultados
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 md:justify-end">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-foreground">
                    ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setLines((prev) => [...prev, EMPTY_LINE])}>
                  <Plus className="mr-2 h-4 w-4" /> Linea
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const lineHasPriceList = hasPriceList && !!line.item_id;
                const lockPrice = lineHasPriceList && line.pricing_mode === "LIST_PRICE";
                const picked = line.item_id ? availableItemsById.get(line.item_id) ?? null : null;
                const pickedLabel = picked
                  ? `${picked.sku} | ${picked.display_name ?? picked.name}`
                  : line.item_id
                    ? `${line.sku_snapshot || "-"} | ${line.description || "-"}`
                    : "";
                return (
                  <div key={idx} className="rounded-[calc(var(--radius)+0.15rem)] border border-border/70 bg-card/70 p-2 shadow-[var(--shadow-xs)]">
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-12 md:col-span-5">
                        {line.item_id ? (
                          <div
                            className="h-9 rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground"
                            title={pickedLabel}
                          >
                            <span className="block truncate">{pickedLabel}</span>
                          </div>
                        ) : hasPriceList ? (
                          <div className="h-9 rounded-md border border-dashed border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                            Usa el buscador de arriba para agregar un producto
                          </div>
                        ) : (
                          <Input
                            className="h-9"
                            placeholder="Descripcion"
                            value={line.description}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setLines(next);
                            }}
                          />
                        )}
                      </div>

                      <Input
                        className="col-span-4 md:col-span-1 h-9"
=======
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
                <div key={`${line.item_id ?? "manual"}-${index}`} className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,2.8fr)_130px_210px_150px_170px_150px_auto] xl:items-center">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">
                        {line.sku_snapshot ? `${line.sku_snapshot} | ` : ""}
                        {line.description}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Unidad: {line.unit || "un"} | Precio sugerido: {formatMoney(line.suggested_unit_price)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: Number(event.target.value) || 0 })
                        }
                      />
<<<<<<< HEAD

                      <div className="col-span-8 md:col-span-2">
                        <Input
                          className="h-9 text-right text-[15px] font-semibold"
                          type="number"
                          min={0}
                          step="any"
                          value={line.unit_price}
                          disabled={lockPrice}
                          title={lineHasPriceList ? `Sugerido: $${line.suggested_unit_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}` : undefined}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = {
                              ...next[idx],
                              unit_price: Number(e.target.value) || 0,
                              price_overridden_at: lineHasPriceList ? new Date().toISOString() : next[idx].price_overridden_at,
                            };
                            setLines(next);
                          }}
                        />
                      </div>

                      <div className="col-span-12 md:col-span-2 flex items-center gap-2">
                        {lineHasPriceList ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={line.pricing_mode}
                              onValueChange={(value) => {
                                const nextMode = value as LinePricingMode;
                                const next = [...lines];
                                if (nextMode === "LIST_PRICE") {
                                  next[idx] = {
                                    ...next[idx],
                                    pricing_mode: nextMode,
                                    unit_price: next[idx].suggested_unit_price,
                                    manual_margin_pct: null,
                                    price_overridden_at: null,
                                    price_overridden_by: null,
                                  };
                                } else if (nextMode === "MANUAL_MARGIN") {
                                  const marginPct = next[idx].manual_margin_pct ?? next[idx].list_utilidad_pct_snapshot ?? 0;
                                  next[idx] = {
                                    ...next[idx],
                                    pricing_mode: nextMode,
                                    manual_margin_pct: Number(marginPct),
                                    unit_price: calculatePriceFromCostBase(
                                      next[idx].base_cost_snapshot ?? 0,
                                      next[idx].list_flete_pct_snapshot,
                                      Number(marginPct),
                                      next[idx].list_impuesto_pct_snapshot,
                                    ),
                                    price_overridden_at: new Date().toISOString(),
                                  };
                                } else {
                                  next[idx] = {
                                    ...next[idx],
                                    pricing_mode: nextMode,
                                    price_overridden_at: new Date().toISOString(),
                                  };
                                }
                                setLines(next);
                              }}
                            >
                              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LIST_PRICE">{PRICING_MODE_LABEL.LIST_PRICE}</SelectItem>
                                <SelectItem value="MANUAL_MARGIN">{PRICING_MODE_LABEL.MANUAL_MARGIN}</SelectItem>
                                <SelectItem value="MANUAL_PRICE">{PRICING_MODE_LABEL.MANUAL_PRICE}</SelectItem>
                              </SelectContent>
                            </Select>

                            {line.pricing_mode === "MANUAL_MARGIN" ? (
                              <Input
                                className="h-9 w-[120px]"
                                type="number"
                                min={0}
                                step="any"
                                value={line.manual_margin_pct ?? ""}
                                onChange={(e) => {
                                  const marginPct = e.target.value === "" ? 0 : Number(e.target.value);
                                  const next = [...lines];
                                  next[idx] = {
                                    ...next[idx],
                                    manual_margin_pct: marginPct,
                                    unit_price: calculatePriceFromCostBase(
                                      next[idx].base_cost_snapshot ?? 0,
                                      next[idx].list_flete_pct_snapshot,
                                      marginPct,
                                      next[idx].list_impuesto_pct_snapshot,
                                    ),
                                    price_overridden_at: new Date().toISOString(),
                                  };
                                  setLines(next);
                                }}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Precio manual</span>
                        )}
                      </div>

                      <div className="col-span-12 md:col-span-2 flex items-center justify-between gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-sm font-mono text-foreground">
                            ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(idx)}
                          title="Eliminar linea"
                          aria-label="Eliminar linea"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
=======
                    </div>

                    <div className="space-y-2">
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LIST_PRICE">{PRICING_MODE_LABEL.LIST_PRICE}</SelectItem>
                          <SelectItem value="MANUAL_MARGIN">{PRICING_MODE_LABEL.MANUAL_MARGIN}</SelectItem>
                          <SelectItem value="MANUAL_PRICE">{PRICING_MODE_LABEL.MANUAL_PRICE}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Margen %</Label>
                      <Input
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

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Precio unitario</Label>
                      <Input
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

                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Total</div>
                      <div className="mt-1 text-lg font-semibold">{formatMoney(lineTotal)}</div>
                    </div>

                    <div className="flex items-end justify-end xl:justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-muted-foreground hover:text-destructive"
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
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
          </div>
        </div>

<<<<<<< HEAD
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-[calc(var(--radius)+0.15rem)] border border-border/60 bg-background/85 px-4 py-3 shadow-[var(--shadow-xs)] backdrop-blur-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
              <p className="text-lg font-extrabold tracking-tight text-foreground">
                ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting} className="h-10 rounded-full px-6">
              {isSubmitting ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
            </Button>
          </div>
        </form>
=======
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
>>>>>>> 6ba8b97 (fix: simplify documents modal line flow (#157))
    </EntityDialog>
  );
}
