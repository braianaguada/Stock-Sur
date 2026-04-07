import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps = {
  title: ReactNode;
  sorted?: "asc" | "desc" | false;
  onToggleSort?: () => void;
  className?: string;
};

export function DataTableColumnHeader({
  title,
  sorted = false,
  onToggleSort,
  className,
}: DataTableColumnHeaderProps) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;

  if (!onToggleSort) {
    return <span className={className}>{title}</span>;
  }

  return (
    <button
      type="button"
      onClick={onToggleSort}
      className={cn("inline-flex items-center gap-1 font-medium text-left hover:text-foreground", className)}
    >
      <span>{title}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
