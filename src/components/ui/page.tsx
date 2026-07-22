import type { ReactNode } from "react";
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
      <div className="relative flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4 lg:min-w-[min(100%,28rem)] lg:flex-1">
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
          <div className="flex min-w-0 w-full flex-wrap items-center gap-3 sm:w-auto lg:max-w-full lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}

export function FilterToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <section aria-label="Filtros" className={cn("filter-strip", className)}>{children}</section>;
}
