import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Plus, Search, Settings2 } from "lucide-react";
import { DataCard, PageHeader, StatCard } from "@/components/ui/page";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { cn } from "@/lib/utils";
import { StockCurrentTable } from "@/features/stock/components/StockCurrentTable";
import { StockMovementDialog } from "@/features/stock/components/StockMovementDialog";
import { StockMovementsTable } from "@/features/stock/components/StockMovementsTable";
import { useStockPage } from "@/features/stock/hooks/useStockPage";
import type { DemandProfile, MovementType, StockHealth } from "@/features/stock/types";

const INTEGER_ONLY_UNITS = new Set(["un"]);
const STOCK_PAGE_SIZE = 10;

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

  const alerts = useMemo(() => {
    const critical = stockRows
      .filter((row) => row.health === "RED")
      .map((row) => ({
        id: `critical-${row.item_id}`,
        tone: "RED" as const,
        title: `${row.item_name} en riesgo critico`,
        detail:
          row.total <= 0
            ? "Sin stock o en negativo. Reposicion urgente."
            : `Cobertura estimada: ${Math.max(0, row.days_of_cover ?? 0).toFixed(1)} dias.`,
      }));
    const low = stockRows
      .filter((row) => row.health === "YELLOW")
      .map((row) => ({
        id: `low-${row.item_id}`,
        tone: "YELLOW" as const,
        title: `${row.item_name} con cobertura baja`,
        detail: `Cobertura estimada: ${(row.days_of_cover ?? 0).toFixed(1)} dias.`,
      }));
    const overstock = stockRows
      .filter((row) => !row.low_rotation && row.days_of_cover !== null && row.days_of_cover > 90)
      .map((row) => ({
        id: `over-${row.item_id}`,
        tone: "GRAY" as const,
        title: `${row.item_name} con posible sobrestock`,
        detail: `Cobertura estimada: ${row.days_of_cover!.toFixed(1)} dias.`,
      }));
    const lowRotationInfo = stockRows
      .filter((row) => row.low_rotation && row.total > 0)
      .map((row) => {
        const months = row.months_of_cover_low_rotation;
        if (months !== null && months >= 24) {
          return {
            id: `slow-over-${row.item_id}`,
            tone: "YELLOW" as const,
            title: `${row.item_name} con sobrestock en baja rotacion`,
            detail: `Cobertura estimada: ${months.toFixed(1)} meses. Revisar compras futuras.`,
          };
        }
        return {
          id: `slow-${row.item_id}`,
          tone: "GRAY" as const,
          title: `${row.item_name} con rotacion baja`,
          detail:
            months !== null
              ? `Cobertura estimada en baja rotacion: ${months < 0.1 ? "<0.1" : months.toFixed(1)} meses.`
              : "Demanda muy baja o irregular: el semaforo prioriza stock disponible.",
        };
      });

    return [...critical, ...low, ...overstock, ...lowRotationInfo];
  }, [stockRows]);

  const warningCount = useMemo(
    () => alerts.filter((alert) => alert.tone === "YELLOW").length,
    [alerts],
  );
  const alertsPagination = usePaginationSlice({
    items: alerts,
    page: alertsPage,
    pageSize: STOCK_PAGE_SIZE,
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
    pageSize: STOCK_PAGE_SIZE,
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="En rojo" value={stockRows.filter((row) => row.health === "RED").length} tone="danger" />
              <StatCard label="En amarillo" value={warningCount} tone="warning" />
              <StatCard label="Sin datos" value={stockRows.filter((row) => row.health === "GRAY").length} />
              <StatCard label="Alertas" value={alerts.length} tone="success" />
            </div>
            <p className="text-xs text-muted-foreground">
              Semaforo automatico: combina consumo de 30, 90 y 365 dias, con tratamiento especial para rotacion baja.
            </p>
            {alerts.length > 0 ? (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70 bg-[hsl(var(--panel))]/55">
                  <CardTitle className="text-lg">Alertas inteligentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-7">
                  {alertsPagination.pagedItems.map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4.5 text-sm shadow-[var(--shadow-xs)] ${alertRowClass[alert.tone]}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{alert.title}</p>
                        <p className="mt-1 text-muted-foreground">{alert.detail}</p>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0", alertBadgeClass[alert.tone])}>
                        {alertToneLabel[alert.tone]}
                      </Badge>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {alertsPagination.rangeStart}-{alertsPagination.rangeEnd} de {alerts.length} alertas
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setAlertsPage((prev) => Math.max(1, prev - 1))}
                        disabled={alertsPagination.page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="min-w-24 text-center text-sm text-muted-foreground">
                        Pagina {alertsPagination.page} de {alertsPagination.totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setAlertsPage((prev) => Math.min(alertsPagination.totalPages, prev + 1))}
                        disabled={alertsPagination.page >= alertsPagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
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
              onPageChange={setStockPage}
              itemLabel="productos"
            />
          </TabsContent>

          <TabsContent value="movements">
            <DataCard>
              <StockMovementsTable
                movements={movements}
                isLoading={loadingMovements}
                formatQuantity={formatQuantity}
                typeIcon={typeIcon}
                typeLabel={typeLabel}
              />
            </DataCard>
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
