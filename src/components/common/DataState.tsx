import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataStateVariant = "loading" | "empty" | "error";

type DataStateProps = {
  variant: DataStateVariant;
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

const defaultIcons: Record<DataStateVariant, ReactNode> = {
  loading: <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
  empty: <Inbox className="h-5 w-5" aria-hidden="true" />,
  error: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
};

export function DataState({
  variant,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: DataStateProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={variant === "loading" || undefined}
      data-state={variant}
      className={cn("mx-auto flex min-h-28 max-w-md flex-col items-center justify-center gap-2 text-center", className)}
    >
      <div
        className={cn(
          "rounded-full border bg-muted/30 p-2 text-muted-foreground",
          isError && "border-destructive/30 bg-destructive/10 text-destructive",
        )}
      >
        {icon ?? defaultIcons[variant]}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
