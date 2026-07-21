import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownCircle, ArrowUpCircle, Loader2, Plus, Search, Settings2, Sparkles } from "lucide-react";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { fetchStockAiSummary, type StockAiSummaryResult } from "@/features/stock/aiAlerts";
import { StockCurrentTable } from "@/features/stock/components/StockCurrentTable";
import { StockMovementDialog } from "@/features/stock/components/StockMovementDialog";
import { StockMovementsTable } from "@/features/stock/components/StockMovementsTable";
import { useStockPage } from "@/features/stock/hooks/useStockPage";
import { buildStockInsights, countStockInsightTones, getStockInsightKindLabel } from "@/features/stock/insights";
import { formatStockQuantity } from "@/lib/stock-quantity";
import type { DemandProfile, MovementType, StockHealth } from "@/features/stock/types";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

function formatCoverage(value: number | null, unit: "m" | "d") {
  if (value === null || !Number.isFinite(value)) return "Sin consumo";
  if (value <= 0) return `0 ${unit}`;
  if (value < 0.1) return `<0.1 ${unit}`;
  return `${value.toFixed(1)} ${unit}`;
}

export default function StockPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setupItemId = searchParams.get("setup") === "1" ? searchParams.get("itemId") : null;
  const linkedItemHandled = useRef<string | null>(null);
  const [tab, setTab] = useState("summary");
  const [alertsPage, setAlertsPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [alertsPageSize, setAlertsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [stockPageSize, setStockPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPageSize, setMovementsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [healthFilter, setHealthFilter] = useState<StockHealth | "ALL">("ALL");
  const [demandFilter, setDemandFilter] = useState<DemandProfile | "ALL">("ALL");
  const [aiSummary, setAiSummary] = useState<(StockAiSummaryResult & { signature: string }) | null>(null);
  const {
    currentCompany,
    dialogOpen,
    form,
    itemSearch,
    availableItems,
    stockByItemId,
    selectedItem,
    searchingItems,
    allStockRows,
    stockRows,
    loadingStock,
    movements,
    filteredMovements,
    loadingMovements,
    search,
    setSearch,
    movementSearch,
    setMovementSearch,
    isSaving,
    openCreateMovement,
    handleDialogOpenChange,
    handleFormChange,
    handleItemSearchChange,
    handleSelectedItemChange,
    submitMovement,
  } = useStockPage();

  const typeIcon = (type: MovementType) => {
    if (type === "IN") return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
    if (type === "OUT") return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
    return <Settings2 className="h-4 w-4 text-yellow-500" />;
  };

  const typeLabel: Record<MovementType, string> = {
    IN: "Entrada",
    OUT: "Salida",
    ADJUSTMENT: "Ajuste",
  };
  const healthLabel: Record<StockHealth, string> = {
    GREEN: "Verde",
    YELLOW: "Amarillo",
    RED: "Rojo",
    GRAY: "Sin datos",
  };
  const insightBadgeTone = { RED: "danger", YELLOW: "warning", BLUE: "info", GRAY: "muted" } as const;
  const demandProfileLabel: Record<DemandProfile, string> = {
    LOW: "Rotacion baja",
    MEDIUM: "Rotacion media",
    HIGH: "Rotacion alta",
  };

  const alerts = useMemo(() => buildStockInsights(stockRows), [stockRows]);
  const alertsSignature = useMemo(
    () => `${currentCompany?.id ?? "none"}:${alerts.map((alert) => `${alert.id}:${alert.priority}`).join("|")}`,
    [alerts, currentCompany?.id],
  );
  const aiSummaryMutation = useMutation({
    mutationFn: (variables: { alerts: typeof alerts; signature: string }) =>
      fetchStockAiSummary({
        companyName: currentCompany?.name ?? null,
        alerts: variables.alerts,
      }),
    onSuccess: (result, variables) => {
      setAiSummary(result ? { ...result, signature: variables.signature } : null);
    },
  });
  const currentAiSummary = aiSummary?.signature === alertsSignature ? aiSummary : null;
  const insightCounts = useMemo(() => countStockInsightTones(alerts), [alerts]);
  const alertsPagination = usePaginationSlice({
    items: alerts,
    page: alertsPage,
    pageSize: alertsPageSize,
  });
  const sortedStockRows = useMemo(() => {
    const priority: Record<StockHealth, number> = {
      RED: 0,
      YELLOW: 1,
      GRAY: 2,
      GREEN: 3,
    };

    return [...stockRows]
      .filter((row) => healthFilter === "ALL" || row.health === healthFilter)
      .filter((row) => demandFilter === "ALL" || row.demand_profile === demandFilter)
      .sort((left, right) => {
        const diff = priority[left.health] - priority[right.health];
        if (diff !== 0) return diff;
        return left.item_name.localeCompare(right.item_name);
      });
  }, [stockRows, healthFilter, demandFilter]);

  useEffect(() => {
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      linkedItemHandled.current = null;
      return;
    }
    const navigationKey = `${currentCompany?.id ?? "no-company"}:${searchParams.toString()}`;
    if (linkedItemHandled.current === navigationKey) return;
    const item = allStockRows.find((row) => row.item_id === itemId);
    if (!item) return;

    linkedItemHandled.current = navigationKey;
    setTab(searchParams.get("tab") === "summary" ? "summary" : "current");
    setSearch(item.item_sku);
    if (searchParams.get("newMovement") === "1") {
      openCreateMovement({
        id: item.item_id,
        name: item.item_name,
        sku: item.item_sku,
        unit: item.item_unit,
        supplier: item.item_supplier,
        brand: item.item_brand,
        model: item.item_model,
        attributes: item.item_attributes,
        category: item.item_category,
      });
    }
  }, [allStockRows, currentCompany?.id, openCreateMovement, searchParams, setSearch]);
  const stockPagination = usePaginationSlice({
    items: sortedStockRows,
    page: stockPage,
    pageSize: stockPageSize,
  });
  const movementsPagination = usePaginationSlice({
    items: filteredMovements,
    page: movementsPage,
    pageSize: movementsPageSize,
  });

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para ver existencias y registrar movimientos de stock." />
        ) : null}
        <PageHeader
          eyebrow="Control de existencias"
          title="Stock"
          subtitle="Control de existencias, cobertura y movimientos con la misma logica actual en una jerarquia mas clara."
          tabs={[
            { label: "Resumen", value: "summary" },
            { label: "Stock", value: "current" },
            { label: "Movimientos", value: "movements" },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          variant="workspace"
          actions={(
            <Button onClick={openCreateMovement}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
            </Button>
          )}
        />
        {setupItemId ? (
          <Card className="flex flex-col gap-3 border-primary/25 bg-primary/5 p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Paso 2 de 2: cargar stock inicial</p>
              <p className="text-sm text-muted-foreground">Guardá el movimiento y después finalizá el alta del producto.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => navigate("/items")}>
              Finalizar alta
            </Button>
          </Card>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="summary" className="space-y-6 pt-1">
            <MetricGrid className="xl:grid-cols-3">
              <MetricCard
                label="Riesgo critico"
                value={insightCounts.RED}
                tone="danger"
              />
              <MetricCard
                label="Atencion"
                value={insightCounts.YELLOW}
                tone="warning"
              />
              <MetricCard
                label="Oportunidades"
                value={insightCounts.BLUE}
                tone="success"
              />
            </MetricGrid>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {currentAiSummary?.summary ??
                    "Alertas calculadas con reglas operativas sobre cobertura, consumo, sobrestock y stock inmovilizado."}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Fuente: reglas operativas</span>
                  {currentAiSummary?.model ? <span>Resumen IA: {currentAiSummary.model}</span> : null}
                  {aiSummaryMutation.isError ? (
                    <span className="text-destructive">
                      {aiSummaryMutation.error instanceof Error
                        ? aiSummaryMutation.error.message
                        : "No se pudo generar el resumen con IA."}
                    </span>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={alerts.length === 0 || aiSummaryMutation.isPending}
                onClick={() => aiSummaryMutation.mutate({ alerts, signature: alertsSignature })}
              >
                {aiSummaryMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {currentAiSummary ? "Actualizar resumen IA" : "Resumir con IA"}
              </Button>
            </div>
            {alerts.length > 0 ? (
              <Card>
                <CardHeader className="border-b border-border/70 bg-[hsl(var(--panel))]/55">
                  <CardTitle className="text-lg">Alertas operativas</CardTitle>
                </CardHeader>
                <CardContent className="pt-7">
                  <div className="space-y-2.5 pt-4">
                    {alertsPagination.pagedItems.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border/70 px-4 py-4 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{alert.title}</p>
                          <p className="mt-1 text-muted-foreground">{alert.detail}</p>
                          <p className="mt-2 text-xs font-medium text-foreground/80">
                            Sugerencia: {alert.suggestedAction}
                          </p>
                        </div>
                        <StatusBadge tone={insightBadgeTone[alert.tone]} className="shrink-0">
                          {getStockInsightKindLabel(alert.kind)}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <DataTablePagination
                      page={alertsPagination.page}
                      totalPages={alertsPagination.totalPages}
                      totalItems={alerts.length}
                      rangeStart={alertsPagination.rangeStart}
                      rangeEnd={alertsPagination.rangeEnd}
                      pageSize={alertsPageSize}
                      pageSizeOptions={PAGE_SIZE_OPTIONS}
                      onPageChange={setAlertsPage}
                      onPageSizeChange={(value) => {
                        setAlertsPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number]);
                        setAlertsPage(1);
                      }}
                      itemLabel="alertas"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="current" className="space-y-5 pt-1">
            <FilterToolbar>
              <div className="relative max-w-sm flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="stock-search"
                  name="stock-search"
                  aria-label="Buscar item en stock"
                  placeholder="Buscar por nombre, SKU, marca, modelo o atributos..."
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="w-full md:w-44">
                <Select value={healthFilter} onValueChange={(v) => { setHealthFilter(v as StockHealth | "ALL"); setStockPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Semáforo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="RED">🔴 Crítico</SelectItem>
                    <SelectItem value="YELLOW">🟡 Atención</SelectItem>
                    <SelectItem value="GREEN">🟢 OK</SelectItem>
                    <SelectItem value="GRAY">⚪ Sin datos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-44">
                <Select value={demandFilter} onValueChange={(v) => { setDemandFilter(v as DemandProfile | "ALL"); setStockPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Demanda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toda la demanda</SelectItem>
                    <SelectItem value="HIGH">Alta rotación</SelectItem>
                    <SelectItem value="MEDIUM">Rotación media</SelectItem>
                    <SelectItem value="LOW">Baja rotación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FilterToolbar>
            <Card className="min-w-0 border-border/70 p-4 shadow-none">
              <StockCurrentTable
                rows={stockPagination.pagedItems}
                isLoading={loadingStock}
                pageSize={stockPageSize}
                formatCoverage={formatCoverage}
                formatQuantity={formatStockQuantity}
                healthLabel={healthLabel}
                demandProfileLabel={demandProfileLabel}
              />
            </Card>
            <DataTablePagination
              page={stockPagination.page}
              totalPages={stockPagination.totalPages}
              totalItems={sortedStockRows.length}
              rangeStart={stockPagination.rangeStart}
              rangeEnd={stockPagination.rangeEnd}
              pageSize={stockPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setStockPage}
              onPageSizeChange={(value) => {
                setStockPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number]);
                setStockPage(1);
              }}
              itemLabel="productos"
            />
          </TabsContent>

          <TabsContent value="movements" className="space-y-5 pt-1">
            <FilterToolbar><div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar movimiento"
                placeholder="Buscar por producto, marca, atributos o referencia..."
                className="pl-9"
                value={movementSearch}
                onChange={(event) => {
                  setMovementSearch(event.target.value);
                  setMovementsPage(1);
                }}
              />
            </div></FilterToolbar>
            <Card className="min-w-0 border-border/70 p-4 shadow-none">
              <StockMovementsTable
                movements={movementsPagination.pagedItems}
                isLoading={loadingMovements}
                pageSize={movementsPageSize}
                formatQuantity={formatStockQuantity}
                typeIcon={typeIcon}
                typeLabel={typeLabel}
              />
            </Card>
            <DataTablePagination
              page={movementsPagination.page}
              totalPages={movementsPagination.totalPages}
              totalItems={filteredMovements.length}
              rangeStart={movementsPagination.rangeStart}
              rangeEnd={movementsPagination.rangeEnd}
              pageSize={movementsPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setMovementsPage}
              onPageSizeChange={(value) => {
                setMovementsPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number]);
                setMovementsPage(1);
              }}
              itemLabel="movimientos"
            />
          </TabsContent>
        </Tabs>
      </PageContainer>

      <StockMovementDialog
        open={dialogOpen}
        form={form}
        itemSearch={itemSearch}
        availableItems={availableItems}
        stockByItemId={stockByItemId}
        selectedItem={selectedItem}
        searchingItems={searchingItems}
        isSaving={isSaving}
        onOpenChange={handleDialogOpenChange}
        onSubmit={submitMovement}
        onFormChange={handleFormChange}
        onItemSearchChange={handleItemSearchChange}
        onSelectedItemChange={handleSelectedItemChange}
      />
    </AppLayout>
  );
}
