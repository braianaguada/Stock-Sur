import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Info } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardAction, DashboardActionTone } from "@/features/index/dashboard-insights";
import { cn } from "@/lib/utils";

const toneStyles: Record<DashboardActionTone, { icon: typeof Info; className: string }> = {
  default: { icon: Info, className: "bg-muted text-muted-foreground" },
  info: { icon: Info, className: "bg-info/10 text-info" },
  warning: { icon: AlertTriangle, className: "bg-warning/10 text-warning" },
  danger: { icon: CircleAlert, className: "bg-destructive/10 text-destructive" },
};

export function OperationalAttention({ actions }: { actions: DashboardAction[] }) {
  const pending = actions.filter((action) => action.count > 0);

  return (
    <section className="dashboard-panel flex h-full min-h-[360px] flex-col" aria-labelledby="operational-attention-title">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-5 sm:px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/70 text-foreground">
          <CircleAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="operational-attention-title" className="text-base font-semibold">Atención operativa</h2>
          <p className="text-xs text-muted-foreground">Prioridades que requieren una decisión</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {pending.length ? pending.map((action) => {
          const tone = toneStyles[action.tone];
          const Icon = tone.icon;
          return (
            <Link
              key={action.key}
              to={action.href}
              className="group flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-background/55 px-3 py-2.5 transition-colors hover:border-primary/25 hover:bg-primary/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.className)}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <strong className="w-9 shrink-0 text-xl font-semibold tabular-nums">{action.count}</strong>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{action.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{action.detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          );
        }) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-success/25 bg-success/[.04] px-5 py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
            <p className="mt-3 font-semibold">Operación al día</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">No detectamos pendientes en los indicadores disponibles.</p>
          </div>
        )}
      </div>
    </section>
  );
}
