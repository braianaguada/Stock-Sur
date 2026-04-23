import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggleSort}
      className={cn("-ml-3 h-8 px-3 font-medium text-left hover:bg-muted/50", className)}
    >
      <span>{title}</span>
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
