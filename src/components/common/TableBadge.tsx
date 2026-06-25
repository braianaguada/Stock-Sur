import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TableBadgeTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";

const TABLE_BADGE_TONE_CLASS: Record<TableBadgeTone, string> = {
  neutral: "border-border/70 bg-muted/55 text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  info: "border-info/20 bg-info/10 text-info",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
};

type TableBadgeProps = {
  children: ReactNode;
  tone?: TableBadgeTone;
  className?: string;
  title?: string;
};

export function TableBadge({
  children,
  tone = "neutral",
  className,
  title,
}: TableBadgeProps) {
  return (
    <Badge
      variant="outline"
      title={title}
      className={cn(
        "h-5 w-fit max-w-full gap-1 px-1.5 py-0 text-[10px] font-medium normal-case tracking-normal",
        TABLE_BADGE_TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}
