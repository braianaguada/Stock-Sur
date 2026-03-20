import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, PanelLeft, Trash2 } from "lucide-react";

type RoundMode = "none" | "integer" | "tens" | "hundreds" | "x99";

type PriceListLite = {
  id: string;
  name: string;
  flete_pct: number;
  utilidad_pct: number;
  impuesto_pct: number;
  round_mode: RoundMode;
  round_to: number;
};

type CatalogItem = {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
};

type PriceListItem = {
  item_id: string;
  base_cost: number;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  final_price_override: number | null;
  items: CatalogItem | null;
};

type LineDraft = {
  base_cost: string;
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  final_price_override: string;
};

type ListConfigDraft = {
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  round_mode: RoundMode;
  round_to: string;
};

interface PriceListItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedList: PriceListLite | null;
  listItems: PriceListItem[];
  availableItems: CatalogItem[];
  itemSearch: string;
  onItemSearchChange: (value: string) => void;
  itemToAdd: string;
  onItemToAddChange: (value: string) => void;
  onAddItem: () => void;
  addItemPending: boolean;
  selectedCatalogItems: Record<string, boolean>;
  onToggleCatalogItem: (itemId: string, checked: boolean) => void;
  selectedCatalogItemIds: string[];
  onAddSelected: () => void;
  onAddFiltered: () => void;
  addItemsBulkPending: boolean;
  listConfigDraft: ListConfigDraft | null;
  onListConfigDraftChange: (updater: (prev: ListConfigDraft | null) => ListConfigDraft | null) => void;
  onUpdateListConfig: (payload: Partial<Pick<PriceListLite, "flete_pct" | "utilidad_pct" | "impuesto_pct" | "round_mode" | "round_to">>) => void;
  lineDrafts: Record<string, LineDraft>;
  onLineDraftChange: (itemId: string, key: keyof LineDraft, value: string) => void;
  onUpdateItem: (args: {
    itemId: string;
    base_cost?: number;
    flete_pct?: number | null;
    utilidad_pct?: number | null;
    impuesto_pct?: number | null;
    final_price_override?: number | null;
  }) => void;
  calculateFinalPrice: (line: PriceListItem) => number;
  onRequestRemoveItem: (line: PriceListItem) => void;
  parseNonNegative: (value: string, fallback?: number) => number;
  parseNullableNonNegative: (value: string) => number | null;
  sanitizeNonNegativeDraft: (value: string) => string;
  onSaveAndClose: () => void;
}

const PAGE_SIZE = 100;

export function PriceListItemsDialog({
  open,
  onOpenChange,
  selectedList,
  listItems,
  availableItems,
  itemSearch,
  onItemSearchChange,
  itemToAdd,
  onItemToAddChange,
  onAddItem,
  addItemPending,
  selectedCatalogItems,
  onToggleCatalogItem,
  selectedCatalogItemIds,
  onAddSelected,
  onAddFiltered,
  addItemsBulkPending,
  listConfigDraft,
  onListConfigDraftChange,
  onUpdateListConfig,
  lineDrafts,
  onLineDraftChange,
  onUpdateItem,
  calculateFinalPrice,
  onRequestRemoveItem,
  parseNonNegative,
  parseNullableNonNegative,
  sanitizeNonNegativeDraft,
  onSaveAndClose,
}: PriceListItemsDialogProps) {
  const [mobileAddPanelOpen, setMobileAddPanelOpen] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(listItems.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = useMemo(
    () => listItems.slice(pageStart, pageStart + PAGE_SIZE),
    [listItems, pageStart],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!open) {
      setMobileAddPanelOpen(false);
      setPage(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-screen w-screen max-w-none overflow-hidden p-0">
        <div className="flex h-full flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 z-20 shrink-0 border-b bg-background px-4 py-3 lg:px-6">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>Ítems asociados a la lista</DialogTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {selectedList ? `Lista: ${selectedList.name}` : "Editá costos y márgenes sin romper la vista"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="lg:hidden" onClick={() => setMobileAddPanelOpen((v) => !v)}>
                  <PanelLeft className="mr-2 h-4 w-4" /> Agregar
                </Button>
                <Button onClick={onSaveAndClose}>Guardar</Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-3 py-3 lg:px-6 lg:py-4">
            <div className="relative grid h-full gap-4 lg:grid-cols-[340px_1fr]">
              <aside
                className={[
                  "h-full overflow-hidden rounded-lg border bg-card",
                  "flex flex-col",
                  "lg:static lg:z-auto lg:flex",
                  mobileAddPanelOpen ? "absolute inset-0 z-30 flex" : "hidden",
                ].join(" ")}
              >
                <div className="shrink-0 space-y-3 border-b p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">Agregar ítems</h3>
                    <Button variant="ghost" className="lg:hidden" onClick={() => setMobileAddPanelOpen(false)}>Cerrar</Button>
                  </div>
                  <Input
                    placeholder="Buscar por SKU o nombre"
                    value={itemSearch}
                    onChange={(e) => onItemSearchChange(e.target.value)}
                  />
                  <Select value={itemToAdd} onValueChange={onItemToAddChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                    <SelectContent>
                      {availableItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.sku} - {it.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    onClick={onAddItem}
                    disabled={!itemToAdd || addItemPending}
                  >
                    Agregar a la lista
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-[44px] px-2 py-2">Sel</TableHead>
                        <TableHead className="px-2 py-2">Item</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                            Sin ítems para agregar
                          </TableCell>
                        </TableRow>
                      ) : availableItems.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedCatalogItems[it.id])}
                              onChange={(e) => onToggleCatalogItem(it.id, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate px-2 py-2 text-xs" title={`${it.sku ?? ""} - ${it.name}`}>
                            {it.sku} - {it.name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="shrink-0 border-t p-4">
                  <div className="grid gap-2">
                    <Button onClick={onAddSelected} disabled={selectedCatalogItemIds.length === 0 || addItemsBulkPending}>
                      Agregar seleccionados ({selectedCatalogItemIds.length})
                    </Button>
                    <Button variant="outline" onClick={onAddFiltered} disabled={availableItems.length === 0 || addItemsBulkPending}>
                      Agregar filtrados ({availableItems.length})
                    </Button>
                  </div>
                </div>
              </aside>

              <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
                {selectedList && (
                  <div className="shrink-0 border-b p-4">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1">
                        <Label className="text-xs">Flete %</Label>
                        <Input
                          className="w-24"
                          min={0}
                          type="number"
                          step="any"
                          value={listConfigDraft?.flete_pct ?? ""}
                          onChange={(e) => onListConfigDraftChange((prev) => (prev ? { ...prev, flete_pct: sanitizeNonNegativeDraft(e.target.value) } : prev))}
                          onBlur={(e) => onUpdateListConfig({ flete_pct: parseNonNegative(e.target.value, selectedList.flete_pct) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Utilidad %</Label>
                        <Input
                          className="w-24"
                          min={0}
                          type="number"
                          step="any"
                          value={listConfigDraft?.utilidad_pct ?? ""}
                          onChange={(e) => onListConfigDraftChange((prev) => (prev ? { ...prev, utilidad_pct: sanitizeNonNegativeDraft(e.target.value) } : prev))}
                          onBlur={(e) => onUpdateListConfig({ utilidad_pct: parseNonNegative(e.target.value, selectedList.utilidad_pct) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Impuesto %</Label>
                        <Input
                          className="w-24"
                          min={0}
                          type="number"
                          step="any"
                          value={listConfigDraft?.impuesto_pct ?? ""}
                          onChange={(e) => onListConfigDraftChange((prev) => (prev ? { ...prev, impuesto_pct: sanitizeNonNegativeDraft(e.target.value) } : prev))}
                          onBlur={(e) => onUpdateListConfig({ impuesto_pct: parseNonNegative(e.target.value, selectedList.impuesto_pct) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Redondeo</Label>
                        <Select
                          value={listConfigDraft?.round_mode ?? selectedList.round_mode}
                          onValueChange={(value) => {
                            onListConfigDraftChange((prev) => (prev ? { ...prev, round_mode: value as RoundMode } : prev));
                            onUpdateListConfig({ round_mode: value as RoundMode });
                          }}
                        >
                          <SelectTrigger className="w-28"><SelectValue placeholder="Modo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin redondeo</SelectItem>
                            <SelectItem value="integer">Entero</SelectItem>
                            <SelectItem value="tens">Decenas</SelectItem>
                            <SelectItem value="hundreds">Centenas</SelectItem>
                            <SelectItem value="x99">Terminar en .99</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cada</Label>
                        <Input
                          className="w-24"
                          min={0}
                          type="number"
                          step="any"
                          value={listConfigDraft?.round_to ?? ""}
                          onChange={(e) => onListConfigDraftChange((prev) => (prev ? { ...prev, round_to: sanitizeNonNegativeDraft(e.target.value) } : prev))}
                          onBlur={(e) => onUpdateListConfig({ round_to: Math.max(0.0001, parseNonNegative(e.target.value, selectedList.round_to)) })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-b px-4 py-2">
                  <h3 className="text-sm font-semibold">Items en la lista ({listItems.length})</h3>
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                </div>

                <div className="flex-1 overflow-auto">
                  <Table className="w-full table-fixed">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead className="w-[34%] px-2 py-2">Item</TableHead>
                        <TableHead className="w-[100px] px-2 py-2">Base</TableHead>
                        <TableHead className="w-[220px] px-2 py-2">F / U / I (%)</TableHead>
                        <TableHead className="w-[110px] px-2 py-2 text-right">Final</TableHead>
                        <TableHead className="w-[190px] px-2 py-2">Manual / Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                            Sin ítems asociados
                          </TableCell>
                        </TableRow>
                      ) : pageItems.map((li) => {
                        const draft = lineDrafts[li.item_id];
                        return (
                          <TableRow key={li.item_id}>
                            <TableCell className="max-w-[260px] truncate px-2 py-2 text-sm" title={`${li.items?.sku ?? ""} - ${li.items?.name ?? ""}`}>
                              {li.items?.sku} - {li.items?.name}
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <Input
                                min={0}
                                className="w-24 text-right font-mono"
                                type="number"
                                step="any"
                                value={draft?.base_cost ?? "0"}
                                onChange={(e) => onLineDraftChange(li.item_id, "base_cost", sanitizeNonNegativeDraft(e.target.value))}
                                onBlur={() => onUpdateItem({ itemId: li.item_id, base_cost: parseNonNegative(draft?.base_cost ?? "0", 0) })}
                              />
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  className="w-20"
                                  min={0}
                                  type="number"
                                  step="any"
                                  placeholder="F"
                                  value={draft?.flete_pct ?? ""}
                                  onChange={(e) => onLineDraftChange(li.item_id, "flete_pct", sanitizeNonNegativeDraft(e.target.value))}
                                  onBlur={() => onUpdateItem({ itemId: li.item_id, flete_pct: parseNullableNonNegative(draft?.flete_pct ?? "") })}
                                />
                                <Input
                                  className="w-20"
                                  min={0}
                                  type="number"
                                  step="any"
                                  placeholder="U"
                                  value={draft?.utilidad_pct ?? ""}
                                  onChange={(e) => onLineDraftChange(li.item_id, "utilidad_pct", sanitizeNonNegativeDraft(e.target.value))}
                                  onBlur={() => onUpdateItem({ itemId: li.item_id, utilidad_pct: parseNullableNonNegative(draft?.utilidad_pct ?? "") })}
                                />
                                <Input
                                  className="w-20"
                                  min={0}
                                  type="number"
                                  step="any"
                                  placeholder="I"
                                  value={draft?.impuesto_pct ?? ""}
                                  onChange={(e) => onLineDraftChange(li.item_id, "impuesto_pct", sanitizeNonNegativeDraft(e.target.value))}
                                  onBlur={() => onUpdateItem({ itemId: li.item_id, impuesto_pct: parseNullableNonNegative(draft?.impuesto_pct ?? "") })}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-2 text-right font-mono">
                              ${calculateFinalPrice(li).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="px-2 py-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  min={0}
                                  className="w-24 text-right font-mono"
                                  type="number"
                                  step="any"
                                  placeholder="Manual"
                                  value={draft?.final_price_override ?? ""}
                                  onChange={(e) => onLineDraftChange(li.item_id, "final_price_override", sanitizeNonNegativeDraft(e.target.value))}
                                  onBlur={() => {
                                    const value = parseNullableNonNegative(draft?.final_price_override ?? "");
                                    onUpdateItem({ itemId: li.item_id, final_price_override: value !== null && value > 0 ? value : null });
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    onLineDraftChange(li.item_id, "final_price_override", "");
                                    onUpdateItem({ itemId: li.item_id, final_price_override: null });
                                  }}
                                >
                                  Auto
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => onRequestRemoveItem(li)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex shrink-0 items-center justify-between border-t px-4 py-2">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {pageItems.length} de {listItems.length} ítems
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
