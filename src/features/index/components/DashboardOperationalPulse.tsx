import { ArrowRight, BadgeDollarSign, CircleGauge, PackageCheck, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import type { DashboardInsights } from "@/features/index/dashboard-insights";
import { buildDashboardOperationalKpis, type DashboardOperationalKpi } from "@/features/index/dashboard-view-model";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, signDisplay: "exceptZero" });

const icons = {
  receivables: BadgeDollarSign,
  "sales-growth": TrendingUp,
  "valued-stock": PackageCheck,
  "slow-stock": CircleGauge,
} satisfies Record<DashboardOperationalKpi["key"], typeof CircleGauge>;

const tones: Record<DashboardOperationalKpi["tone"], string> = {
  default: "bg-muted text-muted-foreground",
  positive: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

function formatValue(kpi: DashboardOperationalKpi) {
  if (kpi.format === "currency") return money.format(kpi.value);
  if (kpi.format === "percent") return `${percent.format(kpi.value)}%`;
  return String(kpi.value);
}

export function DashboardOperationalPulse({ dashboard }: { dashboard: DashboardInsights }) {
  const kpis = buildDashboardOperationalKpis(dashboard);

  return (
    <Card className="h-full border-border/70 shadow-none" aria-labelledby="dashboard-operational-pulse-title">
      <div className="border-b border-border/60 px-5 py-5">
        <h2 id="dashboard-operational-pulse-title" className="text-base font-semibold">Pulso operativo</h2>
        <p className="text-xs text-muted-foreground">Indicadores para decidir qué revisar primero</p>
      </div>
      <div className={cn("grid gap-3 p-5", kpis.length > 2 && "sm:grid-cols-2")}>
        {kpis.map((kpi) => {
          const Icon = icons[kpi.key];
          return (
            <Link
              key={kpi.key}
              to={kpi.href}
              className="group flex min-w-0 items-start gap-3 rounded-2xl border border-border/60 bg-background/55 p-3 transition-colors hover:border-primary/25 hover:bg-primary/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[kpi.tone])}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{kpi.label}</span>
                <strong className="mt-0.5 block text-xl font-semibold tabular-nums">{formatValue(kpi)}</strong>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{kpi.detail}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
