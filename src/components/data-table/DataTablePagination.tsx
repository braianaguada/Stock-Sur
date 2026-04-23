import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DataTablePaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
};

export function DataTablePagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  itemLabel = "registros",
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[calc(var(--radius)+0.15rem)] border border-border/60 bg-card/90 px-4 py-3 shadow-[var(--shadow-xs)] md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-muted-foreground">
        Mostrando {rangeStart}-{rangeEnd} de {totalItems} {itemLabel}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {pageSize !== undefined && pageSizeOptions && onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="data-table-page-size" className="text-sm text-muted-foreground">
              Filas
            </Label>
            <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger id="data-table-page-size" className="w-[96px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon" onClick={() => onPageChange(1)} disabled={page <= 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
