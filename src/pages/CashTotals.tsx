import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { CountBadge, InfoBadge, MetricCard, MetricGrid, MoneyCell, PrimaryCell } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useCashTotalsReport } from "@/features/cash/hooks/useCashTotalsReport";
import { buildCashTotalsReport, getCashTotalsRange, type CashDailyTotal, type CashTotalsPeriod } from "@/features/cash/lib/cashTotals";
import { getErrorMessage } from "@/lib/errors";
import { formatBusinessDate, todayBusinessDateInputValue } from "@/lib/formatters";

const periodLabels: Record<CashTotalsPeriod, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  range: "Rango",
};

function amountClass(value: number) {
  if (value < 0) return "text-destructive";
  if (value > 0) return "text-success";
  return "text-muted-foreground";
}

export default function CashTotalsPage() {
  const { currentCompany } = useAuth();
  const [period, setPeriod] = useState<CashTotalsPeriod>("month");
  const [anchorDate, setAnchorDate] = useState(todayBusinessDateInputValue());
  const [customFrom, setCustomFrom] = useState(todayBusinessDateInputValue());
  const [customTo, setCustomTo] = useState(todayBusinessDateInputValue());

  const range = useMemo(
    () => getCashTotalsRange(period, anchorDate, { from: customFrom, to: customTo }),
    [anchorDate, customFrom, customTo, period],
  );

  const reportQuery = useCashTotalsReport(currentCompany?.id, range.from, range.to);

  const report = reportQuery.data ?? buildCashTotalsReport([], [], []);
  const selectedDay = report.days[0] ?? null;

  const columns = useMemo<ColumnDef<CashDailyTotal, unknown>[]>(() => [
    {
      accessorKey: "businessDate",
      header: "Fecha",
      cell: ({ row }) => (
        <PrimaryCell
          title={formatBusinessDate(row.original.businessDate)}
          metadata={`${row.original.salesCount} venta${row.original.salesCount === 1 ? "" : "s"}${row.original.pendingReceiptCount ? ` · ${row.original.pendingReceiptCount} pendiente${row.original.pendingReceiptCount === 1 ? "" : "s"}` : ""}`}
        />
      ),
    },
    { accessorKey: "cashTotal", header: "Efectivo", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.cashTotal} /> },
    { accessorKey: "transferTotal", header: "Transferencia", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.transferTotal} /> },
    { accessorKey: "mercadoPagoTotal", header: "Point / MP", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.mercadoPagoTotal} /> },
    { accessorKey: "accountCurrentTotal", header: "Cuenta corriente", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.accountCurrentTotal} /> },
    { id: "services", header: "Servicios / otros", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.servicesRemitoTotal + row.original.otherPaymentTotal} /> },
    { accessorKey: "adjustmentsTotal", header: "Devoluciones", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.adjustmentsTotal} className="text-destructive" /> },
    { accessorKey: "expensesCashTotal", header: "Gastos efectivo", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.expensesCashTotal} className="text-destructive" /> },
    { accessorKey: "expensesNonCashTotal", header: "Gastos no efectivo", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.expensesNonCashTotal} className="text-destructive" /> },
    { accessorKey: "grossSalesTotal", header: "Total ventas", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.grossSalesTotal} /> },
    { accessorKey: "netCashTotal", header: "Efectivo neto", meta: { className: "text-right", cellClassName: "text-right" }, cell: ({ row }) => <MoneyCell value={row.original.netCashTotal} className={amountClass(row.original.netCashTotal)} /> },
  ], []);

  const resetFilters = () => {
    const today = todayBusinessDateInputValue();
    setPeriod("month");
    setAnchorDate(today);
    setCustomFrom(today);
    setCustomTo(today);
  };

  return (
    <AppLayout>
      <PageContainer archetype="analytical" className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para consultar totales de Caja." />
        ) : null}

        <PageHeader
          eyebrow="Caja"
          title="Totales por período"
          subtitle="Resumen diario, semanal, mensual o por rango para reemplazar el control manual en Excel."
          variant="analytical"
        />

        <FilterToolbar className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr))] [&&]:items-end">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={period} onValueChange={(value) => setPeriod(value as CashTotalsPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="range">Rango</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-totals-anchor">{period === "month" ? "Mes de referencia" : "Fecha de referencia"}</Label>
              <Input
                id="cash-totals-anchor"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                disabled={period === "range"}
              />
            </div>

            {period === "range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cash-totals-from">Desde</Label>
                  <Input id="cash-totals-from" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-totals-to">Hasta</Label>
                  <Input id="cash-totals-to" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm">
                <p className="font-medium">{periodLabels[period]}: {formatBusinessDate(range.from)} a {formatBusinessDate(range.to)}</p>
                <p className="text-muted-foreground">Las anulaciones quedan excluidas de los totales.</p>
              </div>
            )}

            <Button type="button" variant="outline" onClick={resetFilters}>
              Limpiar
            </Button>
        </FilterToolbar>

        {reportQuery.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(reportQuery.error, "No se pudo cargar el reporte de totales.")}
          </div>
        ) : null}

        <MetricGrid>
          <MetricCard label="Total vendido" value={report.summary.grossSalesTotal} helper={`${report.summary.salesCount} movimientos · ${report.days.length} día${report.days.length === 1 ? "" : "s"}`} tone="info" />
          <MetricCard label="Efectivo neto" value={report.summary.netCashTotal} helper="Efectivo menos gastos de caja" tone="success" />
          <MetricCard label="Cuenta corriente" value={report.summary.accountCurrentTotal} helper="Separado del efectivo" tone="muted" />
          <MetricCard label="Gastos totales" value={report.summary.expensesTotal} helper="Efectivo + no efectivo" tone="danger" />
        </MetricGrid>
        <MetricGrid columns={3}>
          <MetricCard label="Efectivo bruto" value={report.summary.cashTotal} helper="Remito + facturable" />
          <MetricCard label="Gastos efectivo" value={report.summary.expensesCashTotal} helper="Resta caja física" tone="warning" />
          <MetricCard label="Devoluciones" value={-report.summary.returnsTotal} helper="Servicios / remito" tone="danger" />
        </MetricGrid>

        <Card className="min-w-0 border-border/70 shadow-none">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Totales agrupados por día</CardTitle>
              <CardDescription>Rango consultado: {formatBusinessDate(range.from)} a {formatBusinessDate(range.to)}.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <CountBadge>{report.days.length} {report.days.length === 1 ? "registro" : "registros"}</CountBadge>
              <InfoBadge>{reportQuery.isFetching ? "Actualizando" : "Actualizado"}</InfoBadge>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <DataTable
              columns={columns}
              data={report.days}
              isLoading={reportQuery.isLoading}
              loadingMessage="Cargando totales..."
              emptyMessage="No hay ventas ni gastos en el período seleccionado."
              getRowId={(day) => day.businessDate}
              density="compact"
            />
          </CardContent>
        </Card>

        {selectedDay ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Detalle rápido</CardTitle>
              <CardDescription>
                Último día con datos: {formatBusinessDate(selectedDay.businessDate)}. El desglose transaccional queda para una fase posterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricGrid columns={3}>
                <MetricCard label="Efectivo remito" value={selectedDay.cashRemitoTotal} />
                <MetricCard label="Efectivo facturable" value={selectedDay.cashFacturableTotal} />
                <MetricCard label="Neto total del día" value={selectedDay.netTotal} tone="success" />
              </MetricGrid>
            </CardContent>
          </Card>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
