import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const toneClasses: Record<Tone, string> = {
  default: "from-card via-card to-[hsl(var(--panel))]/45 before:bg-border/70",
  success: "from-card via-card to-success/12 before:bg-success/75",
  warning: "from-card via-card to-warning/14 before:bg-warning/80",
  danger: "from-card via-card to-destructive/12 before:bg-destructive/75",
  info: "from-card via-card to-info/12 before:bg-info/75",
  muted: "from-card via-card to-slate-500/10 before:bg-slate-500/65",
};

const iconToneClasses: Record<Tone, string> = {
  default: "border-border/60 bg-background/80 text-primary",
  success: "border-success/18 bg-success/10 text-success",
  warning: "border-warning/18 bg-warning/12 text-warning",
  danger: "border-destructive/18 bg-destructive/12 text-destructive",
  info: "border-info/18 bg-info/12 text-info",
  muted: "border-slate-500/18 bg-slate-500/10 text-slate-600",
};

const amountSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl sm:text-2xl",
  hero: "text-[clamp(1.75rem,7vw,3rem)]",
} as const;

type AmountDisplayProps = {
  value: number | string;
  size?: keyof typeof amountSizeClasses;
  className?: string;
  title?: string;
  format?: "currency" | "plain";
};

export function AmountDisplay({
  value,
  size = "md",
  className,
  title,
  format = "currency",
}: AmountDisplayProps) {
  const displayValue =
    typeof value === "number" && format === "currency" ? currency.format(value) : String(value);

  return (
    <span
      title={title ?? displayValue}
      className={cn(
        "block min-w-0 max-w-full overflow-x-auto whitespace-nowrap font-semibold leading-tight tabular-nums tracking-normal text-foreground [scrollbar-width:thin]",
        amountSizeClasses[size],
        className,
      )}
    >
      {displayValue}
    </span>
  );
}

type MetricCardProps = {
  label: string;
  value: number | string;
  format?: AmountDisplayProps["format"];
  helper?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
};

export function MetricCard({
  label,
  value,
  format,
  helper,
  icon,
  tone = "default",
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/70 bg-card shadow-none before:absolute before:inset-y-4 before:left-0 before:w-0.5",
        toneClasses[tone],
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex min-h-[126px] items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <AmountDisplay value={value} size="lg" format={format} />
            {helper ? <p className="text-sm leading-5 text-muted-foreground">{helper}</p> : null}
          </div>
          {icon ? (
            <div className={cn("shrink-0 rounded-lg border p-2.5", iconToneClasses[tone])}>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type MetricHeroCardProps = {
  label: string;
  value: number | string;
  helper?: ReactNode;
  breakdown?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function MetricHeroCard({
  label,
  value,
  helper,
  breakdown,
  icon,
  className,
}: MetricHeroCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/70 bg-card shadow-none before:absolute before:inset-y-5 before:left-0 before:w-1 before:bg-primary",
        className,
      )}
    >
      <CardContent className="p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{label}</p>
            <AmountDisplay value={value} size="hero" className="font-extrabold" />
            {helper ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{helper}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {breakdown ? <div className="text-sm text-muted-foreground">{breakdown}</div> : null}
            {icon ? (
              <div className="rounded-lg border border-primary/18 bg-primary/10 p-3 text-primary">
                {icon}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

type OperationalTableShellProps = {
  title: string;
  description?: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function OperationalTableShell({
  title,
  description,
  count,
  actions,
  children,
  className,
}: OperationalTableShellProps) {
  return (
    <Card className={cn("border-border/70 shadow-none", className)}>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {typeof count === "number" ? <CompactBadge>{count} {count === 1 ? "registro" : "registros"}</CompactBadge> : null}
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("border-border/70 shadow-none", className)}>{children}</Card>;
}

export function CompactBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const badgeToneClassName: Record<Tone, string> = {
    default: "",
    success: "border-success/18 bg-success/10 text-success",
    warning: "border-warning/18 bg-warning/12 text-warning",
    danger: "border-destructive/18 bg-destructive/12 text-destructive",
    info: "border-info/18 bg-info/12 text-info",
    muted: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <Badge
      variant="outline"
      className={cn("w-fit max-w-full whitespace-nowrap px-2.5 py-0.5 text-[11px] font-medium", badgeToneClassName[tone], className)}
    >
      {children}
    </Badge>
  );
}
