import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
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
  view: "text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300",
  edit: "text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300",
  success: "text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300",
  warning: "text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300",
  danger: "text-destructive hover:text-destructive",
  muted: "text-zinc-600 hover:text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-300",
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

type RowActionLinkProps = LinkProps & {
  label: string;
  children: ReactNode;
  tone?: RowActionButtonProps["tone"];
};

export function RowActionLink({ label, children, className, tone = "default", ...props }: RowActionLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className={cn("h-10 w-10 shrink-0 rounded-lg", toneClass[tone ?? "default"], className)}
      title={label}
      aria-label={label}
    >
      <Link {...props}>{children}</Link>
    </Button>
  );
}
