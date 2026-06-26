import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Boxes,
  BrainCircuit,
  CircleDollarSign,
  ClipboardCheck,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { dashboard, isFetching, error } = useDashboardStats({ companyId: currentCompany?.id });
  const aiSummary = useDashboardAiSummary();
  const actions = dashboard.actions.filter((action) => action.count > 0);
  const monthlyProfit = dashboard.monthlyProfit.map((point) => ({ ...point, label: formatMonth(point.month) }));
  const maxPayment = dashboard.paymentMethods[0]?.total ?? 1;
  const growth = dashboard.metrics.salesGrowthPct;

  return (
    <AppLayout>
      <div className="page-shell">
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Capital en mercaderia" value={formatCurrency(dashboard.metrics.inventoryValue)} icon={<Wallet className="h-5 w-5" />} hint={`${formatNumber(dashboard.metrics.inventoryUnits)} unidades valorizadas.`} tone="info" />
          <StatCard label="Ventas del mes" value={formatCurrency(dashboard.metrics.salesMonth)} icon={<ReceiptText className="h-5 w-5" />} hint={`Ticket promedio: ${formatCurrency(dashboard.metrics.averageTicket)}.`} tone="success" />
          <StatCard label="Ganancia bruta real" value={formatCurrency(dashboard.metrics.grossProfitMonth)} icon={<BadgeDollarSign className="h-5 w-5" />} hint={`Neta ${formatCurrency(dashboard.metrics.salesNetMonth)} - costos ${formatCurrency(dashboard.metrics.productCostMonth)} - impuestos ${formatCurrency(dashboard.metrics.taxMonth)}. Margen ${formatPercent(dashboard.metrics.profitMarginPct)}.`} tone={dashboard.metrics.grossProfitMonth >= 0 ? "success" : "warning"} />
          <StatCard label="Resultado de caja" value={formatCurrency(dashboard.metrics.cashNetMonth)} icon={<CircleDollarSign className="h-5 w-5" />} hint={`${formatCurrency(dashboard.metrics.expensesMonth)} en gastos del mes.`} tone={dashboard.metrics.cashNetMonth >= 0 ? "success" : "warning"} />
          <StatCard label="Variacion mensual" value={`${growth > 0 ? "+" : ""}${growth}%`} icon={growth >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />} hint="Mes a la fecha contra el mismo tramo anterior." tone={growth >= 0 ? "success" : "warning"} />
          <StatCard label="Saldo por cobrar" value={formatCurrency(dashboard.metrics.accountsReceivable)} icon={<CircleDollarSign className="h-5 w-5" />} hint="Suma de deudas positivas por cliente." tone={dashboard.metrics.accountsReceivable > 0 ? "warning" : "default"} />
          <StatCard label="Stock sin salida reciente" value={formatCurrency(dashboard.metrics.slowStockValue)} icon={<Boxes className="h-5 w-5" />} hint={`${formatNumber(dashboard.metrics.slowStockItems)} items sin salidas en 90 dias.`} tone={dashboard.metrics.slowStockItems > 0 ? "warning" : "default"} />
        </div>

        <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/.12),transparent_45%)]">
          <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></div>
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
              <CardTitle>Ganancia real por mes</CardTitle>
              <p className="text-sm text-muted-foreground">Venta neta, impuestos, costo de productos y ganancia bruta sobre remitos emitidos.</p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyProfit}>
                    <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatNumber(Number(value))} tickLine={false} axisLine={false} width={75} />
                    <Tooltip content={<CashTooltip />} />
                    <Legend />
                    <Bar dataKey="netRevenue" name="Venta neta" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
                    <Bar dataKey="tax" name="Impuestos" radius={[8, 8, 0, 0]} fill="#f59e0b" />
                    <Bar dataKey="productCost" name="Costo productos" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
                    <Bar dataKey="grossProfit" name="Ganancia bruta" radius={[8, 8, 0, 0]} fill="#059669" />
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
                  <div className="h-2.5 rounded-full bg-muted"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.max(6, (entry.total / maxPayment) * 100)}%` }} /></div>
                  <p className="text-xs text-muted-foreground">{formatNumber(entry.count)} operaciones</p>
                </div>
              )) : <p className="py-12 text-center text-sm text-muted-foreground">Todavia no hay ventas registradas este mes.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="surface-card-muted">
            <CardHeader><CardTitle>Pendientes operativos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {actions.length ? actions.map((action) => (
                <Link key={action.key} to={action.href} className={cn("group flex items-center gap-3 rounded-2xl border px-4 py-3", actionToneClasses[action.tone])}>
                  <strong className="text-lg text-foreground">{formatNumber(action.count)}</strong>
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{action.label}</p><p className="truncate text-xs text-muted-foreground">{action.detail}</p></div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )) : <div className="py-10 text-center"><ClipboardCheck className="mx-auto h-7 w-7 text-emerald-600" /><p className="mt-3 text-sm">No hay pendientes detectados.</p></div>}
            </CardContent>
          </Card>

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
