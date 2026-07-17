import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RowActionsProps = {
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
};

export function RowActions({ children, align = "end", className }: RowActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-nowrap items-center gap-1",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}

type RowActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  label: string;
  children: ReactNode;
  tone?: "default" | "view" | "edit" | "success" | "warning" | "danger" | "muted";
};

const toneClass: Record<NonNullable<RowActionButtonProps["tone"]>, string> = {
  default: "text-muted-foreground hover:text-foreground",
  view: "text-info hover:text-info/80",
  edit: "text-[hsl(var(--domain-accent-strong))] hover:text-[hsl(var(--domain-accent))]",
  success: "text-success hover:text-success/80",
  warning: "text-warning hover:text-warning/80",
  danger: "text-destructive hover:text-destructive",
  muted: "text-muted-foreground hover:text-foreground",
};

export function RowActionButton({
  label,
  children,
  className,
  tone = "default",
  type = "button",
  ...props
}: RowActionButtonProps) {
  return (
    <Button
      type={type}
      variant="ghost"
      size="icon"
      className={cn("h-10 w-10 shrink-0 rounded-lg", toneClass[tone], className)}
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
}
