import type { ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type TableEmptyStateProps = {
  colSpan: number;
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function TableEmptyState({ colSpan, title, description, icon, className }: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn("py-10 text-center", className)}>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
          {icon ? <div className="rounded-full border bg-muted/30 p-2 text-muted-foreground/80">{icon}</div> : null}
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? <p className="text-xs leading-5">{description}</p> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
