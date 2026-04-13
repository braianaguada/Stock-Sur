import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChartBarBig,
  CircleHelp,
  HandCoins,
  Package,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/features/index/hooks/useDashboardStats";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatCompactNumber(value: number) {
  return numberFormatter.format(value || 0);
}

function EmptyChartState(props: { title: string; description: string }) {
  const { title, description } = props;
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-background/50 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CircleHelp className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ChartTooltip(props: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>;
  valueFormatter?: (value: number) => string;
}) {
  const { active, label, payload, valueFormatter = formatCompactNumber } = props;
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/95 px-3 py-2 shadow-[var(--shadow-sm)] backdrop-blur-sm">
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p> : null}
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.color}`} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-semibold text-foreground">{valueFormatter(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { settings } = useCompanyBrand();
  const { currentCompany } = useAuth();
  const { dashboard, stats, isFetching } = useDashboardStats({ companyId: currentCompany?.id });

  const topValueChartData = dashboard.topItemsByValue.map((item) => ({
    name: item.name,
    value: item.stockValue,
  }));

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Tu cuenta todavia no tiene una empresa activa. Cuando el superadmin te asigne una, vas a ver aca el resumen de esa operacion." />
        ) : null}

        <PageHeader
          eyebrow="Panel ejecutivo"
          title="Dashboard"
          description={`Resumen visual de ${settings.app_name} sobre el stock hoy registrado en el sistema. Sirve como referencia operativa mientras la facturacion y el descuento automatico de stock todavia viven afuera.`}
          meta={(
            <>
              <Badge variant="outline">Empresa activa</Badge>
              <Badge variant="secondary">Referencia sobre stock interno</Badge>
              {isFetching ? <Badge variant="outline">Actualizando</Badge> : null}
            </>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Capital cargado en mercaderia"
            value={formatCurrency(dashboard.metrics.inventoryValue)}
            icon={<Wallet className="h-5 w-5" />}
            hint="Suma del stock positivo registrado aca y valorizado con costo base."
            tone="info"
            className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_52%)] shadow-[0_24px_50px_-28px_rgba(37,99,235,0.32)]"
          />
          <StatCard
            label="Items con stock"
            value={formatCompactNumber(dashboard.metrics.itemsWithStock)}
            icon={<Boxes className="h-5 w-5" />}
            hint={`${formatCompactNumber(dashboard.metrics.activeItems)} items activos cargados en catalogo.`}
            tone="success"
            className="bg-[radial-gradient(circle_at_top_right,rgba(5,150,105,0.14),transparent_52%)] shadow-[0_24px_50px_-28px_rgba(5,150,105,0.28)]"
          />
          <StatCard
            label="Stock sin costo base"
            value={formatCompactNumber(dashboard.metrics.itemsWithoutCost)}
            icon={<AlertCircle className="h-5 w-5" />}
            hint="Tiene stock cargado pero no entra en la valorizacion hasta definir el costo."
            tone={dashboard.metrics.itemsWithoutCost > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Cobertura valorizada"
            value={`${dashboard.metrics.valuedItemsShare}%`}
            icon={<HandCoins className="h-5 w-5" />}
            hint={`Porcentaje del stock cargado que hoy ya tiene costo base. ${formatCompactNumber(dashboard.metrics.suppliersCount)} proveedores y ${formatCompactNumber(dashboard.metrics.quotesCount)} presupuestos.`}
            tone={dashboard.metrics.valuedItemsShare >= 75 ? "success" : "warning"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
          <Card className="surface-card overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Movimiento</p>
                <CardTitle className="mt-2 text-xl">Entradas y salidas registradas</CardTitle>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Esta lectura toma solo movimientos cargados aca. Mientras la facturacion siga en otro sistema, no representa toda la salida real.
                </p>
              </div>
              <Badge variant="outline" className="rounded-full">
                6 meses
              </Badge>
            </CardHeader>
            <CardContent className="pt-6">
              {dashboard.hasMovementData ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.monthlyMovements} barGap={10}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="in" name="Entradas" radius={[10, 10, 0, 0]} fill="hsl(var(--info))" />
                      <Bar dataKey="out" name="Salidas" radius={[10, 10, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChartState
                  title="Todavia no hay movimientos suficientes"
                  description="Cuando registres mas movimientos internos vas a empezar a ver esta serie. Las facturas hechas afuera todavia no impactan automaticamente."
                />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="surface-card overflow-hidden">
              <CardHeader className="border-b border-border/60 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Composicion</p>
                <CardTitle className="mt-2 text-xl">Estado del stock cargado</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {dashboard.stockComposition.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboard.stockComposition}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={55}
                            outerRadius={78}
                            paddingAngle={4}
                            stroke="transparent"
                          >
                            {dashboard.stockComposition.map((slice) => (
                              <Cell key={slice.name} fill={slice.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {dashboard.stockComposition.map((slice) => (
                        <div key={slice.name} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.fill }} />
                            <span className="text-sm text-foreground">{slice.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground">{formatCompactNumber(slice.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                <EmptyChartState
                  title="Aun no hay stock para clasificar"
                  description="En cuanto empieces a cargar movimientos o ajustes internos, esta composicion se completa sola."
                />
              )}
            </CardContent>
            </Card>

            <Card className="surface-card-muted overflow-hidden">
              <CardHeader className="border-b border-border/60 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lectura rapida</p>
                <CardTitle className="mt-2 text-xl">Calidad del dato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Stock valorizado</p>
                    <p className="text-xs text-muted-foreground">Capital sobre stock registrado aca que ya tiene costo base.</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(dashboard.metrics.inventoryValue)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Potencial sin cubrir</p>
                    <p className="text-xs text-muted-foreground">Mercaderia con stock cargado que hoy no se puede valorizar completa.</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(dashboard.missingValueEstimate)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Unidades disponibles</p>
                    <p className="text-xs text-muted-foreground">Suma total del stock neto positivo registrado en la app.</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{formatCompactNumber(dashboard.metrics.inventoryUnits)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="surface-card overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Ranking</p>
                <CardTitle className="mt-2 text-xl">Capital por item registrado</CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Los productos que hoy concentran mas plata sobre el stock disponible cargado en el sistema.
                </p>
              </div>
              <ChartBarBig className="mt-1 h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="pt-6">
              {topValueChartData.length > 0 ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topValueChartData} layout="vertical" margin={{ left: 16, right: 16 }}>
                      <CartesianGrid stroke="hsl(var(--border) / 0.5)" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={140}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      />
                      <Tooltip content={<ChartTooltip valueFormatter={formatCurrency} />} />
                      <Bar dataKey="value" name="Capital" radius={[0, 12, 12, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChartState
                  title="No hay items valorizados todavia"
                  description="Este ranking aparece automaticamente cuando un producto tiene stock positivo y costo base cargado dentro de la app."
                />
              )}
            </CardContent>
          </Card>

          <Card className="surface-card overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Categorias</p>
                <CardTitle className="mt-2 text-xl">Valor por categoria registrada</CardTitle>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Sirve para ver donde se concentra la mercaderia hoy cargada y empezar a detectar familias sobredimensionadas.
                </p>
              </div>
              <Package className="mt-1 h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent className="pt-6">
              {dashboard.hasCategoryData ? (
                <div className="space-y-4">
                  {dashboard.categoryValues.map((entry, index) => {
                    const maxValue = dashboard.categoryValues[0]?.value ?? 1;
                    const width = maxValue > 0 ? Math.max(10, (entry.value / maxValue) * 100) : 0;
                    const tones = [
                      "from-primary/90 to-info/75",
                      "from-info/90 to-primary/55",
                      "from-success/85 to-info/65",
                      "from-warning/80 to-primary/60",
                      "from-primary/70 to-muted-foreground/55",
                    ];

                    return (
                      <div key={entry.category} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{index + 1}. {entry.category}</span>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(entry.value)}</span>
                        </div>
                        <div className="h-3 rounded-full bg-muted/80">
                          <div
                            className={`h-3 rounded-full bg-gradient-to-r ${tones[index] ?? tones[tones.length - 1]}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyChartState
                  title="Todavia no hay categorias con valor"
                  description="Aparecen apenas haya stock con costo base dentro de alguna categoria del catalogo cargada en la app."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="surface-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Hoy ya queda resuelto</p>
                <h2 className="mt-2 text-xl font-bold">Dashboard inicial operativo</h2>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-primary/10 p-3 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ArrowDownToLine className="h-4 w-4 text-info" />
                  Total de plata sobre mercaderia cargada
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Calculado con `stock positivo registrado x costo base`.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ArrowUpFromLine className="h-4 w-4 text-primary" />
                  Lectura honesta para esta etapa
                </div>
                <p className="mt-1 text-sm text-muted-foreground">No mezcla automaticamente lo facturado afuera con el stock interno cargado aca.</p>
              </div>
            </div>
          </Card>

          <Card className="surface-card-muted p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Graficos siguientes</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                Rotacion y quiebres reales cuando la facturacion tambien descuente stock dentro del sistema.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                Ventas por dia y por mes cuando sumemos datos completos desde Caja, Documentos y facturacion.
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                Margen estimado por categoria cruzando costo base con listas de precios y ventas reales.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
