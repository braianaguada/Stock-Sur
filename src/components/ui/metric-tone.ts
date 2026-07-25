export type MetricTone = "default" | "success" | "warning" | "danger" | "info" | "muted";

export const metricAccentToneClasses: Record<MetricTone, string> = {
  default: "before:bg-border/70",
  success: "before:bg-success/75",
  warning: "before:bg-warning/80",
  danger: "before:bg-destructive/75",
  info: "before:bg-info/75",
  muted: "before:bg-slate-500/65",
};

export const metricSurfaceToneClasses: Record<MetricTone, string> = {
  default: "from-card via-card to-[hsl(var(--panel))]/45",
  success: "from-card via-card to-success/12",
  warning: "from-card via-card to-warning/14",
  danger: "from-card via-card to-destructive/12",
  info: "from-card via-card to-info/12",
  muted: "from-card via-card to-slate-500/10",
};

export const metricIconToneClasses: Record<MetricTone, string> = {
  default: "border-border/60 bg-background/80 text-primary",
  success: "border-success/18 bg-success/10 text-success",
  warning: "border-warning/18 bg-warning/12 text-warning",
  danger: "border-destructive/18 bg-destructive/12 text-destructive",
  info: "border-info/18 bg-info/12 text-info",
  muted: "border-slate-500/18 bg-slate-500/10 text-slate-600",
};
