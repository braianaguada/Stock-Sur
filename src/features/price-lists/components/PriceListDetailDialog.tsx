import { useCallback, useEffect, useRef } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, RefreshCcw, Search, Trash2 } from "lucide-react";
import { PriceListProductsTable } from "@/features/price-lists/components/PriceListProductsTable";
import { PRICE_LIST_STATUS_LABEL } from "@/features/price-lists/constants";
import type { PriceListFormState, PriceListHistoryRow, PriceListProductRow, PriceListSummary } from "@/features/price-lists/types";
import { formatDateTime } from "@/features/price-lists/utils";

type PriceListDetailDialogProps = {
  open: boolean;
  selectedList: PriceListSummary | null;
  selectedListHistory: PriceListHistoryRow[];
  pagedProducts: PriceListProductRow[];
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
  onDelete: () => void;
};

const PRODUCT_COLUMN_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "sku", label: "SKU" },
  { id: "name", label: "Nombre" },
  { id: "attributes", label: "Atributos" },
  { id: "calculated_price", label: "Precio lista" },
  { id: "needs_recalculation", label: "Estado" },
];

export function PriceListDetailDialog({
  open,
  selectedList,
  selectedListHistory,
  pagedProducts,
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
  onDelete,
}: PriceListDetailDialogProps) {
  const configTabRef = useRef<HTMLDivElement | null>(null);
  const historyTabRef = useRef<HTMLDivElement | null>(null);

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
            <TabsList className="w-full justify-start">
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="config">Configuracion</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/42 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {renderPricingSummary(selectedList)}
                    <Badge
                      variant="outline"
                      className={selectedList.status === "UPDATED"
                        ? "px-2.5 py-0.5 text-[10px] border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200"
                        : "px-2.5 py-0.5 text-[10px] border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"}
                    >
                      {PRICE_LIST_STATUS_LABEL[selectedList.status]}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    Ultimo recalculo: {formatDateTime(selectedList.last_recalculated_at)} - {renderUserName(selectedList.last_recalculated_by)}
                  </div>
                </div>
                <Collapsible open={productColumnsOpen} onOpenChange={onProductColumnsOpenChange}>
                  <div className="flex flex-wrap items-center gap-3">
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
                  </div>
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
                  <PriceListProductsTable rows={pagedProducts} columnVisibility={productColumnVisibility} />
                </div>
                <div className="shrink-0 border-t bg-background px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {(detailPage - 1) * 10 + (pagedProducts.length === 0 ? 0 : 1)}-
                      {Math.min(detailPage * 10, detailTotalItems)} de {detailTotalItems} productos
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => onDetailPageChange(Math.max(1, detailPage - 1))} disabled={detailPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-24 text-center text-sm text-muted-foreground">Pagina {detailPage} de {detailTotalPages}</span>
                      <Button type="button" variant="outline" size="icon" onClick={() => onDetailPageChange(Math.min(detailTotalPages, detailPage + 1))} disabled={detailPage >= detailTotalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                      <Label>Margen %</Label>
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
    </Dialog>
  );
}
