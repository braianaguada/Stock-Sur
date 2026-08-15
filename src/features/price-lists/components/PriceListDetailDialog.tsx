import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { StatusBadge } from "@/components/common/VisualSystem";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterToolbar, PageTabs } from "@/components/ui/page";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ChevronDown, CircleDollarSign, RefreshCcw, Search, Trash2 } from "lucide-react";
import { PriceListProductsTable } from "@/features/price-lists/components/PriceListProductsTable";
import { PRICE_LIST_STATUS_LABEL } from "@/features/price-lists/constants";
import type { PriceListFormState, PriceListHistoryRow, PriceListProductRow, PriceListSummary } from "@/features/price-lists/types";
import { formatDateTime } from "@/features/price-lists/utils";
import type { PriceRoundingConfig } from "@/features/pricing/rounding";
import { markupToGrossMargin, summarizePriceListMargins } from "@/features/price-lists/margin";
import { getOperationalPrice } from "@/features/pricing/operational-price";

type PriceListDetailDialogProps = {
  open: boolean;
  selectedList: PriceListSummary | null;
  selectedListHistory: PriceListHistoryRow[];
  pagedProducts: PriceListProductRow[];
  allProducts: PriceListProductRow[];
  detailSearch: string;
  detailTab: string;
  detailPage: number;
  detailTotalItems: number;
  detailTotalPages: number;
  productColumnsOpen: boolean;
  productColumnVisibility: VisibilityState;
  configDraft: PriceListFormState | null;
  isRecalculating: boolean;
  isSavingConfig: boolean;
  isDeleting: boolean;
  stockByItemId?: Map<string, number>;
  priceRoundingConfig?: PriceRoundingConfig | null;
  renderUserName: (userId: string | null) => string;
  renderPricingSummary: (values: { flete_pct: number | null; utilidad_pct: number | null; impuesto_pct: number | null }) => JSX.Element;
  onOpenChange: (open: boolean) => void;
  onDetailTabChange: (value: string) => void;
  onDetailSearchChange: (value: string) => void;
  onDetailPageChange: (page: number) => void;
  onProductColumnsOpenChange: (open: boolean) => void;
  onProductColumnVisibilityChange: (columnId: string, checked: boolean) => void;
  onResetProductColumns: () => void;
  onConfigDraftChange: (updater: (prev: PriceListFormState | null) => PriceListFormState | null) => void;
  onSaveConfig: () => void;
  onRecalculate: () => void;
  onUpdateProductOverride: (itemId: string, values: { enabled: boolean; price: number | null }) => void;
  isSavingProductOverride: boolean;
  onDelete: () => void;
};

const PRODUCT_COLUMN_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Nombre" },
  { id: "stock", label: "Stock" },
  { id: "attributes", label: "Atributos" },
  { id: "calculated_price", label: "Precio operativo" },
  { id: "price_source", label: "Tipo de precio" },
  { id: "estimated_margin", label: "Margen estimado" },
  { id: "needs_recalculation", label: "Estado" },
  { id: "actions", label: "Acciones" },
];

export function PriceListDetailDialog({
  open,
  selectedList,
  selectedListHistory,
  pagedProducts,
  allProducts,
  detailSearch,
  detailTab,
  detailPage,
  detailTotalItems,
  detailTotalPages,
  productColumnsOpen,
  productColumnVisibility,
  configDraft,
  isRecalculating,
  isSavingConfig,
  isDeleting,
  renderUserName,
  renderPricingSummary,
  stockByItemId,
  priceRoundingConfig,
  onOpenChange,
  onDetailTabChange,
  onDetailSearchChange,
  onDetailPageChange,
  onProductColumnsOpenChange,
  onProductColumnVisibilityChange,
  onResetProductColumns,
  onConfigDraftChange,
  onSaveConfig,
  onRecalculate,
  onUpdateProductOverride,
  isSavingProductOverride,
  onDelete,
}: PriceListDetailDialogProps) {
  const configTabRef = useRef<HTMLDivElement | null>(null);
  const historyTabRef = useRef<HTMLDivElement | null>(null);
  const [overrideRow, setOverrideRow] = useState<PriceListProductRow | null>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [overridePrice, setOverridePrice] = useState("");
  const targetMarginPct = markupToGrossMargin(selectedList?.utilidad_pct);
  const marginSummary = useMemo(() => selectedList
    ? summarizePriceListMargins({
        rows: allProducts,
        freightPct: selectedList.flete_pct,
        taxPct: selectedList.impuesto_pct,
        targetMarginPct,
        resolveOperationalPrice: (row) => getOperationalPrice({
          calculatedPrice: row.calculated_price,
          manualOverridePrice: row.final_price_override,
          manualPriceEnabled: row.manual_price_enabled,
          config: priceRoundingConfig,
        }).price,
      })
    : null, [allProducts, priceRoundingConfig, selectedList, targetMarginPct]);

  const scrollActiveTabToTop = useCallback(() => {
    if (detailTab === "config") {
      configTabRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }

    if (detailTab === "history") {
      historyTabRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [detailTab]);

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      scrollActiveTabToTop();
    });

    return () => cancelAnimationFrame(frame);
  }, [open, selectedList?.id, scrollActiveTabToTop]);

  const openOverrideDialog = (row: PriceListProductRow) => {
    setOverrideRow(row);
    setOverrideEnabled(row.manual_price_enabled);
    setOverridePrice(row.final_price_override !== null ? String(row.final_price_override) : "");
  };

  const saveOverride = () => {
    if (!overrideRow) return;
    const parsedPrice = overridePrice.trim() === "" ? null : Number(overridePrice);
    if (overrideEnabled && (parsedPrice === null || !Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      return;
    }
    onUpdateProductOverride(overrideRow.item_id, {
      enabled: overrideEnabled,
      price: overrideEnabled ? parsedPrice : null,
    });
    setOverrideRow(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{selectedList?.name ?? "Detalle de lista"}</DialogTitle>
        </DialogHeader>
        {selectedList ? (
          <Tabs
            key={`${selectedList.id}-${open ? "open" : "closed"}`}
            value={detailTab}
            onValueChange={onDetailTabChange}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <PageTabs
              tabs={[
                { label: "Productos", value: "products" },
                { label: "Configuración", value: "config" },
                { label: "Historial", value: "history" },
              ]}
              value={detailTab}
              onValueChange={onDetailTabChange}
            />

            <TabsContent value="products" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/42 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {renderPricingSummary(selectedList)}
                    <StatusBadge tone={selectedList.status === "UPDATED" ? "success" : "danger"}>
                      {PRICE_LIST_STATUS_LABEL[selectedList.status]}
                    </StatusBadge>
                  </div>
                  <div className="text-muted-foreground">
                    Ultimo recalculo: {formatDateTime(selectedList.last_recalculated_at)} - {renderUserName(selectedList.last_recalculated_by)}
                  </div>
                </div>
                {marginSummary ? (
                  <Collapsible className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                      <span className="flex items-center gap-2 font-semibold"><CircleDollarSign className="h-4 w-4 text-primary" /> Salud de margenes</span>
                      <span>Promedio <strong>{marginSummary.averageMarginPct === null ? "-" : `${marginSummary.averageMarginPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}</strong> ({marginSummary.evaluableCount} evaluados)</span>
                      <span className={marginSummary.belowTargetCount > 0 ? "flex items-center gap-1 text-amber-700 dark:text-amber-300" : ""}>
                        {marginSummary.belowTargetCount > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : null}<strong>{marginSummary.belowTargetCount}</strong> bajo objetivo · {marginSummary.missingCostCount} sin datos evaluables
                      </span>
                      <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="ml-auto h-7">Detalle <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button></CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="pt-2 text-xs text-muted-foreground">
                      El recargo de {selectedList.utilidad_pct.toLocaleString("es-AR")}% equivale a un margen bruto objetivo de {targetMarginPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% sobre la venta neta. Se descuenta IVA y se suma flete al costo.{marginSummary.negativeMarginCount > 0 ? ` ${marginSummary.negativeMarginCount} productos tienen margen negativo.` : ""}
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
                <Collapsible open={productColumnsOpen} onOpenChange={onProductColumnsOpenChange}>
                  <FilterToolbar>
                    <div className="relative max-w-sm flex-1 min-w-[260px]">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar producto..."
                        className="pl-9"
                        value={detailSearch}
                        onChange={(event) => onDetailSearchChange(event.target.value)}
                      />
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" type="button">
                        Columnas
                      </Button>
                    </CollapsibleTrigger>
                  </FilterToolbar>
                  <CollapsibleContent>
                    <Card className="mt-3">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">Columnas visibles</h3>
                            <p className="text-sm text-muted-foreground">La preferencia se guarda por usuario.</p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={onResetProductColumns}>
                            Restaurar
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {PRODUCT_COLUMN_OPTIONS.map((column) => (
                            <label key={column.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={productColumnVisibility[column.id] !== false}
                                onCheckedChange={(checked) => onProductColumnVisibilityChange(column.id, checked === true)}
                              />
                              <span>{column.label}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
                <div className="min-h-0 flex-1 overflow-auto">
                  <PriceListProductsTable
                    rows={pagedProducts}
                    columnVisibility={productColumnVisibility}
                    stockByItemId={stockByItemId}
                    priceRoundingConfig={priceRoundingConfig}
                    freightPct={selectedList.flete_pct}
                    taxPct={selectedList.impuesto_pct}
                    onEditProductOverride={openOverrideDialog}
                  />
                </div>
                <div className="shrink-0 border-t bg-background p-3">
                  <DataTablePagination
                    page={detailPage}
                    totalPages={detailTotalPages}
                    totalItems={detailTotalItems}
                    rangeStart={detailTotalItems === 0 ? 0 : (detailPage - 1) * 10 + 1}
                    rangeEnd={Math.min(detailPage * 10, detailTotalItems)}
                    onPageChange={onDetailPageChange}
                    itemLabel="productos"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent ref={configTabRef} value="config" className="mt-4 min-h-0 flex-1 overflow-auto">
              {configDraft ? (
                <div className="mx-auto w-full max-w-4xl space-y-4 px-1 pb-6 pt-1">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input value={configDraft.name} onChange={(event) => onConfigDraftChange((prev) => (prev ? { ...prev, name: event.target.value } : prev))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripcion</Label>
                    <Textarea value={configDraft.description} onChange={(event) => onConfigDraftChange((prev) => (prev ? { ...prev, description: event.target.value } : prev))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Flete %</Label>
                      <Input type="number" min={0} step="any" value={configDraft.flete_pct} onChange={(event) => onConfigDraftChange((prev) => (prev ? { ...prev, flete_pct: event.target.value } : prev))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Recargo sobre costo %</Label>
                      <Input type="number" min={0} step="any" value={configDraft.utilidad_pct} onChange={(event) => onConfigDraftChange((prev) => (prev ? { ...prev, utilidad_pct: event.target.value } : prev))} />
                    </div>
                    <div className="space-y-2">
                      <Label>IVA %</Label>
                      <Input type="number" min={0} step="any" value={configDraft.impuesto_pct} onChange={(event) => onConfigDraftChange((prev) => (prev ? { ...prev, impuesto_pct: event.target.value } : prev))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultima actualizacion</p>
                      <p className="mt-1 text-sm">{formatDateTime(selectedList.updated_at)}</p>
                      <p className="text-sm text-muted-foreground">{renderUserName(selectedList.updated_by)}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ultimo recalculo</p>
                      <p className="mt-1 text-sm">{formatDateTime(selectedList.last_recalculated_at)}</p>
                      <p className="text-sm text-muted-foreground">{renderUserName(selectedList.last_recalculated_by)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={onSaveConfig} disabled={isSavingConfig}>
                        Guardar configuracion
                      </Button>
                      <Button variant="outline" onClick={onRecalculate} disabled={isRecalculating}>
                        <RefreshCcw className="mr-2 h-4 w-4" /> Recalcular pendientes
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={onDelete}
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar lista
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent ref={historyTabRef} value="history" className="mt-4 min-h-0 flex-1 overflow-auto">
              {selectedListHistory.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Todavia no hay historial para esta lista.
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card/65 shadow-[var(--shadow-xs)]">
                  <div className="hidden grid-cols-[minmax(0,1.4fr)_160px_180px] items-center gap-4 border-b border-border/60 bg-[hsl(var(--panel))]/45 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:grid">
                    <span>Evento</span>
                    <span className="text-right">Productos</span>
                    <span className="text-right">Fecha y usuario</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {selectedListHistory.map((row) => (
                      <div key={row.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_160px_180px] md:items-center md:gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-none">
                            {row.event_type === "LIST_CREATED" ? "Lista creada" : row.event_type === "RECALCULATED" ? "Lista recalculada" : "Configuracion actualizada"}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground md:text-right">
                          {row.affected_items_count} productos afectados
                        </div>
                        <div className="text-sm text-muted-foreground md:text-right">
                          <p>{formatDateTime(row.created_at)}</p>
                          <p className="text-xs">{renderUserName(row.created_by)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
      <Dialog open={!!overrideRow} onOpenChange={(nextOpen) => !nextOpen && setOverrideRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Precio personalizado</DialogTitle>
          </DialogHeader>
          {overrideRow ? (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium">{overrideRow.name}</p>
                <p className="text-muted-foreground">Formula: ${overrideRow.calculated_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={overrideEnabled} onCheckedChange={(checked) => setOverrideEnabled(checked === true)} />
                <span>Usar precio personalizado</span>
              </label>
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={overridePrice}
                  disabled={!overrideEnabled}
                  onChange={(event) => setOverridePrice(event.target.value)}
                />
                {overrideEnabled && (overridePrice.trim() === "" || Number(overridePrice) < 0) ? (
                  <p className="text-xs text-destructive">El precio debe ser mayor o igual a 0.</p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOverrideRow(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={isSavingProductOverride || (overrideEnabled && (overridePrice.trim() === "" || Number(overridePrice) < 0))}
                  onClick={saveOverride}
                >
                  Guardar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
