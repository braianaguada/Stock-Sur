import type { ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataState, type DataStateVariant } from "@/components/common/DataState";
import { cn } from "@/lib/utils";

type TableEmptyStateProps = {
  colSpan: number;
  variant?: DataStateVariant;
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function TableEmptyState({
  colSpan,
  variant = "empty",
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
}: TableEmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className={cn("p-4 text-center", className)}>
        <DataState
          variant={variant}
          title={title}
          description={description}
          icon={icon}
          actionLabel={actionLabel}
          onAction={onAction}
        />
      </TableCell>
    </TableRow>
  );
}
