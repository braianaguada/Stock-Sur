import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import type { DashboardActionTone } from "@/features/index/dashboard-insights";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";
import { cn } from "@/lib/utils";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const monthFormatter = new Intl.DateTimeFormat("es-AR", { month: "short" });

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value: number) {
  return numberFormatter.format(value || 0);
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const label = monthFormatter.format(new Date(year, month - 1, 1)).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const actionToneClasses: Record<DashboardActionTone, string> = {
  default: "border-border/60 bg-background/70 text-muted-foreground",
  info: "border-blue-500/20 bg-blue-500/[.06] text-blue-700",
  warning: "border-amber-500/25 bg-amber-500/[.07] text-amber-700",
  danger: "border-red-500/25 bg-red-500/[.07] text-red-700",
};

function SalesTooltip(props: { active?: boolean; payload?: Array<{ value?: number; payload?: { count?: number } }> }) {
  if (!props.active || !props.payload?.length) return null;
  const entry = props.payload[0];

  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold">{formatCurrency(Number(entry.value ?? 0))}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(entry.payload?.count ?? 0)} ventas registradas</p>
    </div>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { dashboard, isFetching, error } = useDashboardStats({ companyId: currentCompany?.id });
  const actions = dashboard.actions.filter((action) => action.count > 0);
  const monthlySales = dashboard.monthlySales.map((point) => ({ ...point, label: formatMonth(point.month) }));

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Tu cuenta todavia no tiene una empresa activa. Cuando el superadmin te asigne una, vas a ver aca el resumen de esa operacion." />
        ) : null}

        <PageHeader
          eyebrow="Panel operativo"
          title="Dashboard"
          description={`Lo importante de ${settings.app_name} para decidir qué atender hoy y dónde está concentrado el negocio.`}
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
                <p className="font-semibold text-foreground">No se pudo actualizar el resumen operativo</p>
                <p className="mt-1 text-sm text-muted-foreground">El resto del sistema sigue disponible. Volvé a ingresar al dashboard para reintentar.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Capital en mercaderia"
            value={formatCurrency(dashboard.metrics.inventoryValue)}
            icon={<Wallet className="h-5 w-5" />}
            hint={`${formatNumber(dashboard.metrics.inventoryUnits)} unidades valorizadas con costo base.`}
            tone="info"
            className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_52%)]"
          />
          <StatCard
            label="Items con stock"
            value={formatNumber(dashboard.metrics.itemsWithStock)}
            icon={<Boxes className="h-5 w-5" />}
            hint={`${formatNumber(dashboard.metrics.activeItems)} items activos. ${dashboard.metrics.valuedItemsShare}% con costo.`}
            tone="success"
            className="bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.14),transparent_52%)]"
          />
          <StatCard
            label="Ventas del mes"
            value={formatCurrency(dashboard.metrics.salesMonth)}
            icon={<ReceiptText className="h-5 w-5" />}
            hint={`Hoy: ${formatCurrency(dashboard.metrics.salesToday)} en ${formatNumber(dashboard.metrics.salesTodayCount)} ventas.`}
            tone="info"
          />
          <StatCard
            label="Saldo por cobrar"
            value={formatCurrency(dashboard.metrics.accountsReceivable)}
            icon={<CircleDollarSign className="h-5 w-5" />}
            hint="Suma de saldos pendientes positivos por cliente."
            tone={dashboard.metrics.accountsReceivable > 0 ? "warning" : "default"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
          <Card className="surface-card overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Evolucion comercial</p>
                <CardTitle className="mt-2 text-xl">Ventas registradas en caja</CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Importe real cargado por mes, sin ventas anuladas.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/cash-totals">Ver totales</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySales}>
                    <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => formatNumber(Number(value))} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={72} />
                    <Tooltip content={<SalesTooltip />} />
                    <Bar dataKey="total" name="Ventas" radius={[10, 10, 0, 0]} fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card-muted overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Requiere atencion</p>
              <CardTitle className="mt-2 text-xl">Pendientes operativos</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Cruces de información que tienen una acción concreta asociada.</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {actions.length > 0 ? actions.map((action) => (
                <Link
                  key={action.key}
                  to={action.href}
                  className={cn("group flex items-center gap-3 rounded-2xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm", actionToneClasses[action.tone])}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80 text-base font-bold text-foreground">
                    {formatNumber(action.count)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{action.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
              )) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] px-5 py-6 text-center">
                  <ClipboardCheck className="mx-auto h-7 w-7 text-emerald-700" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No hay pendientes detectados</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Los principales circuitos operativos están al día.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card className="surface-card overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Exposicion de capital</p>
              <CardTitle className="mt-2 text-xl">Productos con mayor valor inmovilizado</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Ayuda a detectar dónde se concentra la plata y qué revisar antes de volver a comprar.</p>
            </CardHeader>
            <CardContent className="pt-3">
              {dashboard.topItemsByValue.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {dashboard.topItemsByValue.map((item, index) => (
                    <div key={item.itemId} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatNumber(item.quantity)} unidades · costo {formatCurrency(item.baseCost)}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(item.stockValue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">Todavia no hay productos con stock valorizado.</div>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card overflow-hidden">
            <CardHeader className="border-b border-border/60 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Distribucion</p>
              <CardTitle className="mt-2 text-xl">Capital por categoria</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Las familias que explican la mayor parte del inventario valorizado.</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {dashboard.categoryValues.length > 0 ? dashboard.categoryValues.map((entry, index) => {
                const maxValue = dashboard.categoryValues[0]?.value ?? 1;
                const width = Math.max(8, (entry.value / maxValue) * 100);
                return (
                  <div key={entry.category} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">{index + 1}. {entry.category}</span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(entry.value)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted/80">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-primary to-blue-400" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              }) : (
                <div className="py-12 text-center">
                  <PackageSearch className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">Todavia no hay categorias con stock valorizado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
