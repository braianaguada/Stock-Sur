import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  metricAccentToneClasses,
  metricIconToneClasses,
  metricValueToneClasses,
  type MetricTone,
} from "@/components/ui/metric-tone";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PageArchetype = "standard" | "workspace" | "analytical";

const pageWidthClasses = {
  standard: "max-w-[var(--content-standard)]",
  workspace: "max-w-[var(--content-max)]",
  analytical: "max-w-[var(--content-max)]",
} satisfies Record<PageArchetype, string>;

export function PageContainer({
  children,
  archetype = "standard",
  className,
}: {
  children: ReactNode;
  archetype?: PageArchetype;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", pageWidthClasses[archetype], className)}>
      {children}
    </div>
  );
}

export function PageTabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: Array<{ label: string; value: string }>;
  value: string;
  onValueChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("w-full", className)}>
      <div data-testid="page-header-tabs" className="max-w-full overflow-x-auto pb-1 [scrollbar-width:thin]">
        <TabsList className="w-max min-w-full justify-start sm:min-w-0">
          {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
        </TabsList>
      </div>
    </Tabs>
  );
}

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  description?: string;
  tabs?: Array<{ label: string; value: string }>;
  activeTab?: string;
  onTabChange?: (value: string) => void;
  actions?: ReactNode;
  meta?: ReactNode;
  divider?: boolean;
  variant?: PageArchetype;
  className?: string;
}) {
  const {
    eyebrow,
    title,
    subtitle,
    description,
    tabs,
    activeTab,
    onTabChange,
    actions,
    meta,
    divider = true,
    className,
    variant = "standard",
  } = props;
  const resolvedSubtitle = subtitle ?? description;

  return (
    <section data-variant={variant} className={cn("page-hero shadow-none", variant === "workspace" && "pb-3", variant === "analytical" && "page-hero-analytical", divider && "border-b", className)}>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4">
          {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
          <div className="space-y-2">
            <h1 className="page-title">{title}</h1>
            {resolvedSubtitle ? <p className="page-description">{resolvedSubtitle}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
          {tabs && tabs.length > 0 && activeTab ? (
            <PageTabs tabs={tabs} value={activeTab} onValueChange={onTabChange} />
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto lg:shrink-0 lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export function FilterToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <section aria-label="Filtros" className={cn("filter-strip", className)}>{children}</section>;
}

/** @deprecated Compatibility alias. New screens must use FilterToolbar. */
export const FilterBar = FilterToolbar;

/** @deprecated Compatibility adapter. New screens must use MetricCard. */
export function StatCard(props: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: MetricTone;
  className?: string;
  featured?: boolean;
}) {
  const { label, value, icon, hint, tone = "default", featured = false, className } = props;

  return (
    <Card className={cn("stat-tile relative overflow-hidden border-border/70 bg-card shadow-none before:absolute before:inset-y-4 before:left-0 before:w-0.5", metricAccentToneClasses[tone], featured && "stat-tile-featured before:bg-cyan-300", className)}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className={cn("text-xs font-semibold tracking-[0.08em] text-muted-foreground", featured && "text-indigo-100")}>{label}</p>
            <div className={cn("text-3xl font-extrabold tracking-tight", metricValueToneClasses[tone], featured && "text-white")}>{value}</div>
            {hint ? <p className={cn("text-sm text-muted-foreground", featured && "text-indigo-100/85")}>{hint}</p> : null}
          </div>
          {icon ? (
            <div className={cn("rounded-lg border p-2.5", metricIconToneClasses[tone], featured && "border-cyan-200/25 bg-cyan-300/15 text-cyan-100")}>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** @deprecated Compatibility adapter. New screens must use the canonical Surface/Card recipe. */
export function DataCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("data-panel", className)}>{children}</section>;
}
