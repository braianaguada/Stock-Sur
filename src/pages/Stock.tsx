import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, Plus, Search, Settings2 } from "lucide-react";
import { DataCard, PageHeader, StatCard } from "@/components/ui/page";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { cn } from "@/lib/utils";
import { fetchStockAiAlerts } from "@/features/stock/aiAlerts";
import { StockCurrentTable } from "@/features/stock/components/StockCurrentTable";
import { StockMovementDialog } from "@/features/stock/components/StockMovementDialog";
import { StockMovementsTable } from "@/features/stock/components/StockMovementsTable";
import { useStockPage } from "@/features/stock/hooks/useStockPage";
import { buildStockInsights, countStockInsightTones } from "@/features/stock/insights";
import type { DemandProfile, MovementType, StockHealth } from "@/features/stock/types";

const INTEGER_ONLY_UNITS = new Set(["un"]);
const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

function formatQuantity(value: number, unit: string | null) {
  if (!Number.isFinite(value)) return "-";
  if (unit && INTEGER_ONLY_UNITS.has(unit)) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value));
  }

  const rounded = Number(value.toFixed(3));
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(rounded);
}

function formatCoverage(value: number | null, unit: "m" | "d") {
  if (value === null || !Number.isFinite(value)) return "Sin consumo";
  if (value <= 0) return `0 ${unit}`;
  if (value < 0.1) return `<0.1 ${unit}`;
  return `${value.toFixed(1)} ${unit}`;
}

export default function StockPage() {
  const [tab, setTab] = useState("summary");
  const [alertsPage, setAlertsPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [alertsPageSize, setAlertsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [stockPageSize, setStockPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPageSize, setMovementsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const {
    currentCompany,
    dialogOpen,
    form,
    itemSearch,
    availableItems,
    selectedItem,
    searchingItems,
    stockRows,
    loadingStock,
    movements,
    loadingMovements,
    search,
    setSearch,
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
  const healthClass: Record<StockHealth, string> = {
    GREEN: "bg-emerald-600 text-white border-emerald-700",
    YELLOW: "bg-amber-500 text-black border-amber-600",
    RED: "bg-red-600 text-white border-red-700",
    GRAY: "bg-slate-600 text-white border-slate-700",
  };
  const alertToneLabel: Record<StockHealth, string> = {
    GREEN: "OK",
    YELLOW: "Atencion",
    RED: "Critico",
    GRAY: "Info",
  };
  const alertRowClass: Record<StockHealth, string> = {
    GREEN: "border-success/18 bg-success/10 text-foreground",
    YELLOW: "border-warning/18 bg-warning/10 text-foreground",
    RED: "border-destructive/18 bg-destructive/10 text-foreground",
    GRAY: "border-border/70 bg-[hsl(var(--panel))]/66 text-foreground",
  };
  const alertBadgeClass: Record<StockHealth, string> = {
    GREEN: "border-success/18 bg-success text-success-foreground",
    YELLOW: "border-warning/18 bg-warning text-warning-foreground",
    RED: "border-destructive/18 bg-destructive text-destructive-foreground",
    GRAY: "border-border/70 bg-muted text-foreground",
  };
  const insightToneClass = {
    RED: "border-destructive/18 bg-destructive/10 text-foreground",
    YELLOW: "border-warning/18 bg-warning/10 text-foreground",
    BLUE: "border-info/18 bg-info/10 text-foreground",
    GRAY: "border-border/70 bg-[hsl(var(--panel))]/66 text-foreground",
  } as const;
  const insightBadgeClass = {
    RED: "border-destructive/18 bg-destructive text-destructive-foreground",
    YELLOW: "border-warning/18 bg-warning text-warning-foreground",
    BLUE: "border-info/18 bg-info text-info-foreground",
    GRAY: "border-border/70 bg-muted text-foreground",
  } as const;
  const demandProfileLabel: Record<DemandProfile, string> = {
    LOW: "Rotacion baja",
    MEDIUM: "Rotacion media",
    HIGH: "Rotacion alta",
  };
  const demandProfileClass: Record<DemandProfile, string> = {
    LOW: "border-border/70 bg-muted text-foreground",
    MEDIUM: "border-info/16 bg-info/10 text-info",
    HIGH: "border-primary/16 bg-primary/10 text-primary",
  };

  const alerts = useMemo(() => buildStockInsights(stockRows), [stockRows]);
  const aiAlertsQuery = useQuery({
    queryKey: ["stock-ai-alerts", currentCompany?.id ?? null, stockRows],
    enabled: Boolean(currentCompany?.id && stockRows.length > 0),
    queryFn: () =>
      fetchStockAiAlerts({
        companyName: currentCompany?.name ?? null,
        rows: stockRows,
      }),
  });
  const displayedAlerts = aiAlertsQuery.data?.alerts?.length ? aiAlertsQuery.data.alerts : alerts;
  const insightSummary = aiAlertsQuery.data?.summary ?? null;
  const insightSource = aiAlertsQuery.data?.alerts?.length ? "IA" : "Fallback local";
  const insightModel = aiAlertsQuery.data?.model ?? null;
  const insightCounts = useMemo(() => countStockInsightTones(displayedAlerts), [displayedAlerts]);
  const alertsPagination = usePaginationSlice({
    items: displayedAlerts,
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

    return [...stockRows].sort((left, right) => {
      const diff = priority[left.health] - priority[right.health];
      if (diff !== 0) return diff;
      return left.item_name.localeCompare(right.item_name);
    });
  }, [stockRows]);
  const stockPagination = usePaginationSlice({
    items: sortedStockRows,
    page: stockPage,
    pageSize: stockPageSize,
  });
  const movementsPagination = usePaginationSlice({
    items: movements,
    page: movementsPage,
    pageSize: movementsPageSize,
  });

  return (
    <AppLayout>
      <div className="page-shell">
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
          actions={(
            <Button onClick={openCreateMovement}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
            </Button>
          )}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="summary" className="space-y-6 pt-1">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Riesgo critico"
                value={insightCounts.RED}
                tone="danger"
                className="bg-[radial-gradient(circle_at_bottom_right,rgba(248,113,113,0.22),transparent_58%)] shadow-[0_24px_50px_-28px_rgba(248,113,113,0.55)]"
              />
              <StatCard
                label="Atencion"
                value={insightCounts.YELLOW}
                tone="warning"
                className="shadow-[0_24px_50px_-28px_rgba(250,204,21,0.42)]"
              />
              <StatCard
                label="Oportunidades"
                value={insightCounts.BLUE}
                tone="success"
                className="bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_58%)] shadow-[0_24px_50px_-28px_rgba(16,185,129,0.55)]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {insightSummary ?? "La IA prioriza riesgo de quiebre, aceleracion de consumo, sobrestock y stock inmovilizado sobre el snapshot actual."}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Fuente: {insightSource}</span>
              {insightModel ? <span>Modelo: {insightModel}</span> : null}
              {aiAlertsQuery.isFetching ? <span>Actualizando lectura IA...</span> : null}
            </div>
            {displayedAlerts.length > 0 ? (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70 bg-[hsl(var(--panel))]/55">
                  <CardTitle className="text-lg">Stock inteligente</CardTitle>
                </CardHeader>
                <CardContent className="pt-7">
                  <div className="space-y-2.5 pt-4">
                    {alertsPagination.pagedItems.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4.5 text-sm shadow-[var(--shadow-xs)] ${insightToneClass[alert.tone]}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{alert.title}</p>
                          <p className="mt-1 text-muted-foreground">{alert.detail}</p>
                          <p className="mt-2 text-xs font-medium text-foreground/80">
                            Sugerencia: {alert.suggestedAction}
                          </p>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0", insightBadgeClass[alert.tone])}>
                          {alert.kind.replaceAll("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  <div className="pt-4">
                    <DataTablePagination
                      page={alertsPagination.page}
                      totalPages={alertsPagination.totalPages}
                      totalItems={displayedAlerts.length}
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
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="stock-search"
                name="stock-search"
                aria-label="Buscar item en stock"
                placeholder="Buscar item..."
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <DataCard>
              <StockCurrentTable
                rows={stockPagination.pagedItems}
                isLoading={loadingStock}
                pageSize={stockPageSize}
                formatCoverage={formatCoverage}
                formatQuantity={formatQuantity}
                healthLabel={healthLabel}
                healthClass={healthClass}
                demandProfileLabel={demandProfileLabel}
                demandProfileClass={demandProfileClass}
              />
            </DataCard>
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
            <DataCard>
              <StockMovementsTable
                movements={movementsPagination.pagedItems}
                isLoading={loadingMovements}
                pageSize={movementsPageSize}
                formatQuantity={formatQuantity}
                typeIcon={typeIcon}
                typeLabel={typeLabel}
              />
            </DataCard>
            <DataTablePagination
              page={movementsPagination.page}
              totalPages={movementsPagination.totalPages}
              totalItems={movements.length}
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
      </div>

      <StockMovementDialog
        open={dialogOpen}
        form={form}
        itemSearch={itemSearch}
        availableItems={availableItems}
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
