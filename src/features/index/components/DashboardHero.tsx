import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Boxes, CircleDollarSign, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { buildDashboardViews, type DashboardValueFormat, type DashboardView } from "@/features/index/dashboard-view-model";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const month = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" });
const icons: Record<DashboardView["key"], typeof ReceiptText> = {
  sales: ReceiptText,
  inventory: Boxes,
  profitability: CircleDollarSign,
};
const seriesColors = ["hsl(var(--brand-indigo))", "hsl(var(--brand-cyan))"];

function formatValue(value: number, format: DashboardValueFormat) {
  if (format === "currency") return currency.format(value);
  if (format === "percent") return `${percent.format(value)}%`;
  return number.format(value);
}

function formatMonthLabel(label: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return label;
  return month.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))).replace(".", "");
}

export function DashboardHero({ dashboard }: { dashboard: DashboardInsights }) {
  const views = useMemo(() => buildDashboardViews(dashboard), [dashboard]);
  const [selected, setSelected] = useState(0);
  const view = views[Math.min(selected, views.length - 1)];
  const Icon = icons[view.key];
  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, string | number>>();
    view.series.forEach((chartSeries) => {
      chartSeries.points.forEach((point) => {
        const row = rows.get(point.label) ?? { label: formatMonthLabel(point.label) };
        row[chartSeries.key] = point.value;
        rows.set(point.label, row);
      });
    });
    return [...rows.values()];
  }, [view]);

  const selectAndFocus = (index: number) => {
    const next = (index + views.length) % views.length;
    setSelected(next);
    requestAnimationFrame(() => document.getElementById(`dashboard-tab-${views[next].key}`)?.focus());
  };
  const move = (direction: -1 | 1) => selectAndFocus(selected + direction);
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") selectAndFocus(index + 1);
    else if (event.key === "ArrowLeft") selectAndFocus(index - 1);
    else if (event.key === "Home") selectAndFocus(0);
    else if (event.key === "End") selectAndFocus(views.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <section className="dashboard-panel dashboard-terrain overflow-hidden" aria-labelledby="dashboard-hero-title">
      <div className="relative z-10 flex flex-col gap-4 border-b border-border/50 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-background/55 text-primary shadow-sm">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="dashboard-hero-title" className="text-lg font-semibold">Territorio del negocio</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Indicadores verificables del período actual</p>
            </div>
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Vista anterior"><ArrowLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Vista siguiente"><ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div role="tablist" aria-label="Indicador principal" className="flex gap-1 overflow-x-auto rounded-2xl border border-border/50 bg-background/45 p-1">
          {views.map((candidate, index) => (
            <button
              id={`dashboard-tab-${candidate.key}`}
              key={candidate.key}
              type="button"
              role="tab"
              tabIndex={selected === index ? 0 : -1}
              aria-selected={selected === index}
              aria-controls="dashboard-view-panel"
              onClick={() => setSelected(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn("min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected === index ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground")}
            >
              {candidate.title}
            </button>
          ))}
        </div>
      </div>

      <div id="dashboard-view-panel" role="tabpanel" aria-labelledby={`dashboard-tab-${view.key}`} className="relative z-10 grid min-h-[380px] gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(260px,.85fr)_1.4fr]">
        <div className="flex flex-col justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-primary">{view.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{view.description}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {view.metrics.map((metric, index) => (
              <div key={metric.key} className={cn("rounded-2xl border px-4 py-3 backdrop-blur-sm", index === 0 ? "border-primary/15 bg-primary/[.08]" : "border-border/50 bg-background/45")}>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{formatValue(metric.value, metric.format)}</p>
              </div>
            ))}
          </div>
          <Button asChild className="w-full rounded-full sm:w-fit">
            <Link to={view.href}>{view.actionLabel}<ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="min-h-[240px] rounded-[22px] border border-white/40 bg-background/35 p-3 shadow-[inset_0_1px_0_hsl(var(--background)/.8)] backdrop-blur-sm">
          {view.hasActivity ? (
            <ResponsiveContainer width="100%" height="100%">
              {view.key === "inventory" ? (
                <BarChart data={chartData} accessibilityLayer margin={{ top: 12, right: 10, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="hsl(var(--border) / .45)" vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis hide />
                  <Tooltip formatter={(value: number) => currency.format(value)} />
                  <Bar dataKey={view.series[0].key} name={view.series[0].label} fill="hsl(var(--brand-cyan))" radius={[8, 8, 3, 3]} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} accessibilityLayer margin={{ top: 12, right: 10, left: 0, bottom: 4 }}>
                  <defs>
                    {view.series.map((chartSeries, index) => <linearGradient key={chartSeries.key} id={`hero-fill-${chartSeries.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={seriesColors[index]} stopOpacity=".38" /><stop offset="100%" stopColor={seriesColors[index]} stopOpacity=".03" /></linearGradient>)}
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border) / .45)" vertical={false} strokeDasharray="3 5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis hide />
                  <Tooltip formatter={(value: number) => currency.format(value)} />
                  {view.series.length > 1 ? <Legend /> : null}
                  {view.series.map((chartSeries, index) => <Area key={chartSeries.key} type="monotone" dataKey={chartSeries.key} name={chartSeries.label} stroke={seriesColors[index]} strokeWidth={2.5} fill={`url(#hero-fill-${chartSeries.key})`} />)}
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted-foreground">Todavía no hay actividad suficiente para representar este indicador.</div>}
        </div>
      </div>
    </section>
  );
}
