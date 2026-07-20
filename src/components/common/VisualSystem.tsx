import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  metricAccentToneClasses,
  metricIconToneClasses,
  metricSurfaceToneClasses,
  type MetricTone,
} from "@/components/ui/metric-tone";
import { currency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

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
  allowHorizontalScroll?: boolean;
};

export function PrimaryCell({
  title,
  metadata,
  className,
}: {
  title: ReactNode;
  metadata?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-sm font-medium leading-5 text-foreground">{title}</div>
      {metadata ? <div className="truncate text-xs leading-4 text-muted-foreground">{metadata}</div> : null}
    </div>
  );
}

export function MoneyCell(props: Omit<AmountDisplayProps, "size" | "allowHorizontalScroll">) {
  return <AmountDisplay {...props} size="sm" className={cn("text-right", props.className)} />;
}

export function AmountDisplay({
  value,
  size = "md",
  className,
  title,
  format = "currency",
  allowHorizontalScroll = false,
}: AmountDisplayProps) {
  const displayValue =
    typeof value === "number" && format === "currency" ? currency.format(value) : String(value);

  return (
    <span
      title={title ?? displayValue}
      className={cn(
        "block min-w-0 max-w-full whitespace-nowrap font-semibold leading-tight tabular-nums tracking-normal text-foreground",
        allowHorizontalScroll && "overflow-x-auto [scrollbar-width:thin]",
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
  tone?: MetricTone;
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
        "relative overflow-hidden border-border/70 bg-gradient-to-br shadow-none before:absolute before:inset-y-4 before:left-0 before:w-0.5",
        metricSurfaceToneClasses[tone],
        metricAccentToneClasses[tone],
        className,
      )}
    >
      <CardContent className="p-5">
        <div className="flex min-h-[126px] items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <AmountDisplay value={value} size="lg" format={format} />
            {helper ? <p className="text-sm leading-5 text-muted-foreground">{helper}</p> : null}
          </div>
          {icon ? (
            <div className={cn("shrink-0 rounded-lg border p-2.5", metricIconToneClasses[tone])}>
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

/** @deprecated Compatibility adapter for existing analytical screens. Do not add new consumers. */
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
            <p className="text-xs font-semibold tracking-[0.08em] text-primary">{label}</p>
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

/** @deprecated Compatibility adapter. New operational datasets must compose DataTable in a canonical Surface. */
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

/** @deprecated Compatibility adapter. New screens must use the canonical Surface/Card recipe. */
export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("border-border/70 shadow-none", className)}>{children}</Card>;
}

export function StatusBadge({
  children,
  tone = "default",
  announce = false,
  className,
}: {
  children: ReactNode;
  tone?: MetricTone;
  announce?: boolean;
  className?: string;
}) {
  const badgeToneClassName: Record<MetricTone, string> = {
    default: "",
    success: "border-success/18 bg-success/10 text-success",
    warning: "border-warning/18 bg-warning/12 text-warning",
    danger: "border-destructive/18 bg-destructive/12 text-destructive",
    info: "border-info/18 bg-info/12 text-info",
    muted: "border-border/70 bg-muted/60 text-muted-foreground",
  };

  return (
    <Badge
      variant="outline"
      role={announce ? "status" : undefined}
      className={cn("min-h-6 w-fit max-w-full whitespace-nowrap px-2 py-0 text-xs font-semibold leading-4", badgeToneClassName[tone], className)}
    >
      {children}
    </Badge>
  );
}

/** @deprecated Compatibility alias. Use a semantic badge primitive instead. */
export const CompactBadge = StatusBadge;

export function CountBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <StatusBadge tone="muted" className={className}>{children}</StatusBadge>;
}

export function InfoBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <StatusBadge tone="info" className={className}>{children}</StatusBadge>;
}

export function HealthBadge({
  children,
  healthy,
  className,
}: {
  children: ReactNode;
  healthy: boolean;
  className?: string;
}) {
  return <StatusBadge tone={healthy ? "success" : "warning"} className={className}>{children}</StatusBadge>;
}

export function CategoryBadge({ children, className }: { children: ReactNode; className?: string }) {
  return <StatusBadge className={cn("border-primary/15 bg-primary/8 text-primary", className)}>{children}</StatusBadge>;
}
