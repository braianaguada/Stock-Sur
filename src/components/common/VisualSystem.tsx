import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
        "relative h-full border-border/70 bg-gradient-to-br shadow-none before:absolute before:inset-y-4 before:left-0 before:w-0.5",
        metricSurfaceToneClasses[tone],
        metricAccentToneClasses[tone],
        className,
      )}
    >
      <CardContent className="h-full p-5">
        <div className="flex h-full min-h-[126px] items-center justify-between gap-4">
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

const metricGridColumnClasses = {
  2: "md:grid-cols-2",
  3: "grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]",
  4: "md:grid-cols-2 xl:grid-cols-4",
} as const;

export function MetricGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  columns?: keyof typeof metricGridColumnClasses;
}) {
  return <div className={cn("grid gap-3", metricGridColumnClasses[columns], className)}>{children}</div>;
}

export type BadgeTone = MetricTone;

const badgeToneClassNames: Record<BadgeTone, string> = {
  default: "border-border/70 bg-muted/55 text-foreground",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/12 text-warning",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/20 bg-info/10 text-info",
  muted: "border-border/70 bg-muted/60 text-muted-foreground",
};

const categoryBadgeClassName = "border-primary/20 bg-primary/8 text-primary";

export function StatusBadge({
  children,
  tone = "default",
  announce = false,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  announce?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      role={announce ? "status" : undefined}
      data-badge-kind="status"
      data-badge-tone={tone}
      className={cn(
        "w-fit",
        badgeToneClassNames[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export function CountBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="outline"
      data-badge-kind="count"
      className={cn("w-fit border-border/70 bg-muted/60 text-muted-foreground tabular-nums", className)}
    >
      {children}
    </Badge>
  );
}

export function InfoBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="outline"
      data-badge-kind="info"
      className={cn("w-fit", badgeToneClassNames.info, className)}
    >
      {children}
    </Badge>
  );
}

export function HealthBadge({
  children,
  healthy,
  tone,
  className,
}: {
  children: ReactNode;
  healthy?: boolean;
  tone?: Extract<BadgeTone, "success" | "warning" | "danger" | "muted">;
  className?: string;
}) {
  const resolvedTone = tone ?? (healthy === false ? "warning" : "success");
  return (
    <Badge
      variant="outline"
      data-badge-kind="health"
      data-badge-tone={resolvedTone}
      className={cn("w-fit", badgeToneClassNames[resolvedTone], className)}
    >
      {children}
    </Badge>
  );
}

export function CategoryBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="outline"
      data-badge-kind="category"
      className={cn("w-fit", categoryBadgeClassName, className)}
    >
      {children}
    </Badge>
  );
}
