import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
    className,
  } = props;
  const resolvedSubtitle = subtitle ?? description;

  return (
    <section className={cn("page-hero border-b border-border/70 bg-transparent px-0 pb-5 pt-0 shadow-none", className)}>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4">
          {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
          <div className="space-y-2">
            <h1 className="page-title">{title}</h1>
            {resolvedSubtitle ? <p className="page-description">{resolvedSubtitle}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
          {tabs && tabs.length > 0 && activeTab ? (
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="w-auto justify-start">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3 lg:justify-end">{actions}</div> : null}
      </div>
    </section>
  );
}

export function FilterBar({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("filter-strip", className)}>{children}</section>;
}

export function StatCard(props: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const { label, value, icon, hint, tone = "default", className } = props;
  const toneClassName = {
    default: "from-card via-card to-[hsl(var(--panel))]/40 before:bg-border/70",
    success: "from-card via-card to-success/14 before:bg-success",
    warning: "from-card via-card to-warning/20 before:bg-warning",
    danger: "from-card via-card to-destructive/16 before:bg-destructive",
    info: "from-card via-card to-info/14 before:bg-info",
  }[tone];
  const valueClassName = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    info: "text-info",
  }[tone];
  const iconClassName = {
    default: "border-border/60 bg-background/80 text-primary",
    success: "border-success/18 bg-success/10 text-success",
    warning: "border-warning/18 bg-warning/12 text-warning",
    danger: "border-destructive/18 bg-destructive/12 text-destructive",
    info: "border-info/18 bg-info/12 text-info",
  }[tone];

  return (
    <Card className={cn("stat-tile relative overflow-hidden bg-gradient-to-br before:absolute before:inset-x-5 before:top-0 before:h-px", toneClassName, className)}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <div className={cn("text-3xl font-extrabold tracking-tight", valueClassName)}>{value}</div>
            {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          </div>
          {icon ? (
            <div className={cn("rounded-2xl border p-3 shadow-[var(--shadow-xs)]", iconClassName)}>
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function DataCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("data-panel", className)}>{children}</section>;
}
