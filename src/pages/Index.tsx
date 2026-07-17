import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  CircleDollarSign,
  ClipboardCheck,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import type { DashboardActionTone } from "@/features/index/dashboard-insights";
import { useDashboardAiSummary } from "@/features/index/hooks/useDashboardAiSummary";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "short" });

const paymentLabels: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CUENTA_CORRIENTE: "Cuenta corriente",
  EFECTIVO_REMITO: "Efectivo remito",
  EFECTIVO_FACTURABLE: "Efectivo facturable",
  SERVICIOS_REMITO: "Servicios remito",
};

const actionToneClasses: Record<DashboardActionTone, string> = {
  default: "border-border/60 bg-background/70 text-muted-foreground",
  info: "border-blue-500/20 bg-blue-500/[.06] text-blue-700",
  warning: "border-amber-500/25 bg-amber-500/[.07] text-amber-700",
  danger: "border-red-500/25 bg-red-500/[.07] text-red-700",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value: number) {
  return numberFormatter.format(value || 0);
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value || 0)}%`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const label = monthFormatter.format(new Date(year, month - 1, 1)).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function CashTooltip(props: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
      {props.payload.map((entry) => (
        <p key={entry.name} className="text-xs text-muted-foreground">
          {entry.name}: <strong className="text-foreground">{formatCurrency(Number(entry.value ?? 0))}</strong>
        </p>
      ))}
    </div>
  );
}

function ProfitTooltip(props: { active?: boolean; payload?: Array<{ dataKey?: string; name?: string; value?: number }> }) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
      {props.payload.map((entry) => {
        const value = Number(entry.value ?? 0);
        const formattedValue = entry.dataKey === "profitMarginPct" ? formatPercent(value) : formatCurrency(value);

        return (
          <p key={entry.name} className="text-xs text-muted-foreground">
            {entry.name}: <strong className="text-foreground">{formattedValue}</strong>
          </p>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { dashboard, isFetching, error } = useDashboardStats({ companyId: currentCompany?.id });
  const aiSummary = useDashboardAiSummary();
  const actions = dashboard.actions.filter((action) => action.count > 0);
  const monthlyCash = dashboard.monthlyCash.map((point) => ({ ...point, label: formatMonth(point.month) }));
  const monthlyProfit = dashboard.monthlyProfit.map((point) => ({ ...point, label: formatMonth(point.month) }));
  const maxPayment = dashboard.paymentMethods[0]?.total ?? 1;
  const growth = dashboard.metrics.salesGrowthPct;

  return (
    <AppLayout>
      <div className="page-shell domain-core">
        {!currentCompany ? <CompanyAccessNotice description="Tu cuenta todavia no tiene una empresa activa." /> : null}

        <PageHeader
          eyebrow="Panel operativo"
          title="Dashboard"
          description={`Indicadores cruzados de ${settings.app_name} para entender resultados, riesgos y prioridades.`}
          meta={(
            <>
              <Badge variant="outline">Empresa activa</Badge>
              <Badge variant="secondary">Datos internos actualizados</Badge>
              {isFetching ? <Badge variant="outline"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Actualizando</Badge> : null}
            </>
          )}
        />

        {error ? (
          <Card className="border-red-500/25 bg-red-500/[.05]">
            <CardContent className="flex items-start gap-3 py-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold">No se pudo actualizar el resumen operativo</p>
                <p className="mt-1 text-sm text-muted-foreground">Recarga la pagina para reintentar.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12" data-testid="dashboard-primary-metrics">
          <StatCard className="xl:col-span-6" featured label="Ventas del mes" value={formatCurrency(dashboard.metrics.salesMonth)} icon={<ReceiptText className="h-5 w-5" />} hint={`Ticket promedio: ${formatCurrency(dashboard.metrics.averageTicket)}.`} />
          <StatCard className="xl:col-span-3" label="Ganancia bruta real" value={formatCurrency(dashboard.metrics.grossProfitMonth)} icon={<BadgeDollarSign className="h-5 w-5" />} hint={`Neta ${formatCurrency(dashboard.metrics.salesNetMonth)} - costos ${formatCurrency(dashboard.metrics.productCostMonth)} - impuestos ${formatCurrency(dashboard.metrics.taxMonth)}. Margen ${formatPercent(dashboard.metrics.profitMarginPct)}.`} tone={dashboard.metrics.grossProfitMonth >= 0 ? "success" : "warning"} />
          <StatCard className="xl:col-span-3" label="Resultado de caja" value={formatCurrency(dashboard.metrics.cashNetMonth)} icon={<CircleDollarSign className="h-5 w-5" />} hint={`${formatCurrency(dashboard.metrics.expensesMonth)} en gastos del mes.`} tone={dashboard.metrics.cashNetMonth >= 0 ? "success" : "warning"} />
        </div>

        <section className="grid gap-4 border-y border-border/70 py-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de contexto">
          <div><p className="text-xs text-muted-foreground">Capital en mercaderia</p><p className="mt-1 whitespace-nowrap font-semibold tabular-nums">{formatCurrency(dashboard.metrics.inventoryValue)}</p></div>
          <div><p className="text-xs text-muted-foreground">Variacion mensual</p><p className={cn("mt-1 font-semibold tabular-nums", growth < 0 && "text-destructive")}>{growth > 0 ? "+" : ""}{growth}%</p></div>
          <div><p className="text-xs text-muted-foreground">Saldo por cobrar</p><p className="mt-1 whitespace-nowrap font-semibold tabular-nums">{formatCurrency(dashboard.metrics.accountsReceivable)}</p></div>
          <div><p className="text-xs text-muted-foreground">Stock sin salida · {formatNumber(dashboard.metrics.slowStockItems)} items</p><p className="mt-1 whitespace-nowrap font-semibold tabular-nums">{formatCurrency(dashboard.metrics.slowStockValue)}</p></div>
        </section>

        <Card className="border-border/70 shadow-none">
          <CardHeader><CardTitle>Pendientes operativos</CardTitle></CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {actions.length ? actions.map((action) => (
              <Link key={action.key} to={action.href} className={cn("group flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2", actionToneClasses[action.tone])}>
                <strong className="text-lg tabular-nums text-foreground">{formatNumber(action.count)}</strong>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{action.label}</p><p className="truncate text-xs text-muted-foreground">{action.detail}</p></div>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )) : <div className="py-5 text-center md:col-span-2 xl:col-span-3"><ClipboardCheck className="mx-auto h-6 w-6 text-success" /><p className="mt-2 text-sm">No hay pendientes detectados.</p></div>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-primary/20 shadow-none">
          <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Lectura ejecutiva con IA</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {aiSummary.data?.summary ?? "Analiza tendencias, riesgos y oportunidades usando solamente los datos calculados del dashboard."}
              </p>
              {aiSummary.data?.fallback ? <p className="mt-2 text-xs text-amber-600">Se uso la lectura automatica local porque el proveedor de IA no estaba disponible.</p> : null}
            </div>
            <Button
              type="button"
              disabled={!currentCompany || aiSummary.isPending}
              onClick={() => aiSummary.mutate({ companyName: settings.app_name, dashboard })}
            >
              {aiSummary.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {aiSummary.data ? "Actualizar analisis" : "Analizar con IA"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <Card className="surface-card overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-5">
              <CardTitle>Ventas, gastos y resultado mensual</CardTitle>
              <p className="text-sm text-muted-foreground">Evolucion de caja de los ultimos seis meses.</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div
                className="h-[320px]"
                role="img"
                aria-label="Grafico mensual de ventas, gastos y resultado. Las ventas son barras indigo, los gastos usan un patron rayado ambar y el resultado tiene contorno cyan."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyCash} accessibilityLayer>
                    <defs>
                      <pattern id="dashboard-expenses-pattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="8" height="8" fill="hsl(var(--warning) / .18)" />
                        <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(var(--warning))" strokeWidth="3" />
                      </pattern>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatNumber(Number(value))} tickLine={false} axisLine={false} width={75} />
                    <Tooltip content={<CashTooltip />} />
                    <Legend />
                    <Bar dataKey="sales" name="Ventas" radius={[8, 8, 0, 0]} fill="hsl(var(--brand-indigo))" />
                    <Bar dataKey="expenses" name="Gastos" radius={[8, 8, 0, 0]} fill="url(#dashboard-expenses-pattern)" stroke="hsl(var(--warning))" />
                    <Bar dataKey="net" name="Resultado" radius={[8, 8, 0, 0]} fill="hsl(var(--brand-cyan) / .28)" stroke="hsl(var(--brand-cyan))" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-5">
              <CardTitle>Ventas por medio de pago</CardTitle>
              <p className="text-sm text-muted-foreground">Composicion del mes actual.</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {dashboard.paymentMethods.length ? dashboard.paymentMethods.map((entry) => (
                <div key={entry.method} className="space-y-2">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{paymentLabels[entry.method] ?? entry.method}</span>
                    <span className="shrink-0 font-semibold">{formatCurrency(entry.total)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full bg-[hsl(var(--brand-indigo))]" style={{ width: `${Math.max(6, (entry.total / maxPayment) * 100)}%` }} /></div>
                  <p className="text-xs text-muted-foreground">{formatNumber(entry.count)} operaciones</p>
                </div>
              )) : <p className="py-12 text-center text-sm text-muted-foreground">Todavia no hay ventas registradas este mes.</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="surface-card overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-5">
            <CardTitle>Rentabilidad de ventas emitidas</CardTitle>
            <p className="text-sm text-muted-foreground">Venta neta y ganancia bruta con margen real, descontando impuestos y costo de productos.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              className="h-[300px]"
              role="img"
              aria-label="Grafico de rentabilidad. La venta neta es un area indigo continua, la ganancia bruta es un area verde de trazo discontinuo y el margen es una linea ambar punteada."
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyProfit} accessibilityLayer>
                  <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="money" tickFormatter={(value) => formatNumber(Number(value))} tickLine={false} axisLine={false} width={75} />
                  <YAxis yAxisId="margin" orientation="right" tickFormatter={(value) => formatPercent(Number(value))} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<ProfitTooltip />} />
                  <Legend />
                  <Area yAxisId="money" type="monotone" dataKey="netRevenue" name="Venta neta" stroke="hsl(var(--brand-indigo))" fill="hsl(var(--brand-indigo) / .16)" strokeWidth={2} />
                  <Area yAxisId="money" type="monotone" dataKey="grossProfit" name="Ganancia bruta" stroke="hsl(var(--success))" fill="hsl(var(--success) / .13)" strokeWidth={2} strokeDasharray="3 3" />
                  <Line yAxisId="margin" type="monotone" dataKey="profitMarginPct" name="Margen" stroke="hsl(var(--warning))" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="surface-card">
            <CardHeader><CardTitle>Mayor salida en 30 dias</CardTitle><p className="text-sm text-muted-foreground">Productos a vigilar para reposicion.</p></CardHeader>
            <CardContent className="divide-y divide-border/60">
              {dashboard.stockVelocity.length ? dashboard.stockVelocity.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">Stock actual: {formatNumber(item.currentStock)}</p></div>
                  <Badge variant="secondary">{formatNumber(item.out30)} salidas</Badge>
                </div>
              )) : <p className="py-10 text-center text-sm text-muted-foreground">Sin salidas registradas en 30 dias.</p>}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader><CardTitle>Capital sin movimiento</CardTitle><p className="text-sm text-muted-foreground">Mayor valor sin salidas en 90 dias.</p></CardHeader>
            <CardContent className="divide-y divide-border/60">
              {dashboard.slowStock.length ? dashboard.slowStock.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{formatNumber(item.quantity)} unidades</p></div>
                  <strong className="text-sm">{formatCurrency(item.stockValue)}</strong>
                </div>
              )) : <div className="py-10 text-center"><PackageSearch className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">No hay capital inmovilizado detectado.</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
