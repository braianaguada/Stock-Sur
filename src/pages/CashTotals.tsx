import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { buildCashTotalsReport, getCashTotalsRange, type CashDailyTotal, type CashTotalsPeriod } from "@/features/cash/lib/cashTotals";
import type { CashAdjustmentRow, CashExpenseRow, CashSaleRow } from "@/features/cash/types";
import { todayDateInputValue } from "@/features/cash/utils";
import { getErrorMessage } from "@/lib/errors";
import { currency, formatBusinessDate } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/integrations/supabase/client";

const periodLabels: Record<CashTotalsPeriod, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  range: "Rango",
};

function SummaryCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="min-w-0 overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.14),transparent_55%)] shadow-sm">
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="min-w-0 break-words text-xl tracking-tight sm:text-2xl">{currency.format(value)}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

function amountClass(value: number) {
  if (value < 0) return "text-rose-700";
  if (value > 0) return "text-emerald-700";
  return "text-muted-foreground";
}

export default function CashTotalsPage() {
  const { currentCompany } = useAuth();
  const [period, setPeriod] = useState<CashTotalsPeriod>("month");
  const [anchorDate, setAnchorDate] = useState(todayDateInputValue());
  const [customFrom, setCustomFrom] = useState(todayDateInputValue());
  const [customTo, setCustomTo] = useState(todayDateInputValue());

  const range = useMemo(
    () => getCashTotalsRange(period, anchorDate, { from: customFrom, to: customTo }),
    [anchorDate, customFrom, customTo, period],
  );

  const reportQuery = useQuery({
    queryKey: queryKeys.cash.totals(currentCompany?.id ?? null, range.from, range.to),
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      const [salesResult, expensesResult, adjustmentsResult] = await Promise.all([
        supabase
          .from("cash_sales")
          .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
          .eq("company_id", currentCompany!.id)
          .gte("business_date", range.from)
          .lte("business_date", range.to)
          .order("business_date", { ascending: false })
          .limit(5000),
        supabase
          .from("cash_expenses")
          .select("id, company_id, business_date, spent_at, expense_kind, category, amount_total, description, has_receipt, receipt_reference, notes, closure_id, created_by, created_at, updated_at, cancelled_at, cancelled_by")
          .eq("company_id", currentCompany!.id)
          .gte("business_date", range.from)
          .lte("business_date", range.to)
          .order("business_date", { ascending: false })
          .limit(5000),
        supabase
          .from("cash_adjustments")
          .select("id, company_id, business_date, occurred_at, document_id, adjustment_kind, payment_method, amount_total, signed_amount, customer_id, customer_name_snapshot, closure_id, notes, cancelled_at, cancelled_by, created_by, created_at, updated_at")
          .eq("company_id", currentCompany!.id)
          .gte("business_date", range.from)
          .lte("business_date", range.to)
          .order("business_date", { ascending: false })
          .limit(5000),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (adjustmentsResult.error) throw adjustmentsResult.error;

      return buildCashTotalsReport(
        (salesResult.data ?? []) as CashSaleRow[],
        (expensesResult.data ?? []) as CashExpenseRow[],
        (adjustmentsResult.data ?? []) as CashAdjustmentRow[],
      );
    },
  });

  const report = reportQuery.data ?? buildCashTotalsReport([], [], []);
  const selectedDay = report.days[0] ?? null;

  const resetFilters = () => {
    const today = todayDateInputValue();
    setPeriod("month");
    setAnchorDate(today);
    setCustomFrom(today);
    setCustomTo(today);
  };

  const renderAmount = (value: number, className = "") => (
    <span className={`font-semibold tabular-nums ${className}`}>{currency.format(value)}</span>
  );

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para consultar totales de Caja." />
        ) : null}

        <PageHeader
          eyebrow="Caja"
          title="Totales por período"
          subtitle="Resumen diario, semanal, mensual o por rango para reemplazar el control manual en Excel."
        />

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>El reporte usa ventas y gastos de caja por fecha operativa.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[180px_180px_1fr_auto] md:items-end">
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
          </CardContent>
        </Card>

        {reportQuery.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {getErrorMessage(reportQuery.error, "No se pudo cargar el reporte de totales.")}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <SummaryCard label="Total vendido" value={report.summary.grossSalesTotal} hint={`${report.summary.salesCount} movimientos`} />
          <SummaryCard label="Efectivo bruto" value={report.summary.cashTotal} hint="Remito + facturable" />
          <SummaryCard label="Devoluciones" value={-report.summary.returnsTotal} hint="Servicios / remito" />
          <SummaryCard label="Gastos efectivo" value={report.summary.expensesCashTotal} hint="Resta caja física" />
          <SummaryCard label="Efectivo neto" value={report.summary.netCashTotal} hint="Efectivo menos gastos" />
          <SummaryCard label="Cuenta corriente" value={report.summary.accountCurrentTotal} hint="Separado del efectivo" />
          <SummaryCard label="Gastos totales" value={report.summary.expensesTotal} hint="Efectivo + no efectivo" />
        </div>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Totales agrupados por día</CardTitle>
              <CardDescription>
                Rango consultado: {formatBusinessDate(range.from)} a {formatBusinessDate(range.to)}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{reportQuery.isFetching ? "Actualizando" : "Actualizado"}</Badge>
              <Badge variant="outline">{report.days.length} día{report.days.length === 1 ? "" : "s"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {reportQuery.isLoading ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Cargando totales...
              </div>
            ) : report.days.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay ventas ni gastos en el período seleccionado.
              </div>
            ) : (
              <div className="overflow-auto rounded-xl border">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3 text-right">Efectivo</th>
                      <th className="px-3 py-3 text-right">Transferencia</th>
                      <th className="px-3 py-3 text-right">Point / MP</th>
                      <th className="px-3 py-3 text-right">Cuenta corriente</th>
                      <th className="px-3 py-3 text-right">Servicios / otros</th>
                      <th className="px-3 py-3 text-right">Devoluciones</th>
                      <th className="px-3 py-3 text-right">Gastos efectivo</th>
                      <th className="px-3 py-3 text-right">Gastos no efectivo</th>
                      <th className="px-3 py-3 text-right">Total ventas</th>
                      <th className="px-3 py-3 text-right">Efectivo neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((day: CashDailyTotal) => (
                      <tr key={day.businessDate} className="border-b last:border-b-0">
                        <td className="px-3 py-3">
                          <p className="font-medium">{formatBusinessDate(day.businessDate)}</p>
                          <p className="text-xs text-muted-foreground">
                            {day.salesCount} venta{day.salesCount === 1 ? "" : "s"}
                            {day.pendingReceiptCount ? ` · ${day.pendingReceiptCount} pendiente${day.pendingReceiptCount === 1 ? "" : "s"}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.cashTotal)}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.transferTotal)}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.mercadoPagoTotal)}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.accountCurrentTotal)}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.servicesRemitoTotal + day.otherPaymentTotal)}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.adjustmentsTotal, "text-rose-700")}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.expensesCashTotal, "text-rose-700")}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.expensesNonCashTotal, "text-rose-700")}</td>
                        <td className="px-3 py-3 text-right">{renderAmount(day.grossSalesTotal)}</td>
                        <td className={`px-3 py-3 text-right ${amountClass(day.netCashTotal)}`}>{renderAmount(day.netCashTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            <CardContent className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-muted-foreground">Efectivo remito</p>
                <p className="mt-1 text-lg font-semibold">{currency.format(selectedDay.cashRemitoTotal)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-muted-foreground">Efectivo facturable</p>
                <p className="mt-1 text-lg font-semibold">{currency.format(selectedDay.cashFacturableTotal)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-4">
                <p className="text-muted-foreground">Neto total del día</p>
                <p className="mt-1 text-lg font-semibold">{currency.format(selectedDay.netTotal)}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
