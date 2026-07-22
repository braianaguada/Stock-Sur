import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/common/TableEmptyState";
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyMessage: string;
  isLoading?: boolean;
  loadingMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  columnVisibility?: VisibilityState;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  rowClassName?: string;
  cellClassName?: string;
  reserveEmptyRows?: number;
  density?: "comfortable" | "compact";
  stickyHeader?: boolean;
};

export function DataTable<TData>({
  columns,
  data,
  emptyMessage,
  isLoading = false,
  loadingMessage = "Cargando...",
  errorMessage,
  onRetry,
  className,
  sorting,
  onSortingChange,
  columnVisibility,
  getRowId,
  rowClassName,
  cellClassName,
  reserveEmptyRows = 0,
  density = "comfortable",
  stickyHeader = false,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    manualSorting: true,
    enableSortingRemoval: false,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: onSortingChange ? (updater) => {
      const nextSorting =
        typeof updater === "function" ? updater(sorting ?? []) : updater;
      onSortingChange(nextSorting);
    } : undefined,
  });

  const visibleColumnCount = table.getVisibleLeafColumns().length || columns.length;
  const rows = table.getRowModel().rows;
  const emptyRowsToRender =
    !isLoading && rows.length > 0 && reserveEmptyRows > rows.length
      ? reserveEmptyRows - rows.length
      : 0;

  return (
    <Table
      data-density={density}
      className={cn(
        density === "compact" && "[&_th]:h-10 [&_th]:px-3 [&_td]:h-[var(--table-row-compact)] [&_td]:px-3 [&_td]:py-2",
        density === "comfortable" && "[&_td]:min-h-[var(--table-row-comfortable)]",
        className,
      )}
    >
      <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-background/95 backdrop-blur")}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={cn(header.column.columnDef.meta?.className)}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {errorMessage ? (
          <TableEmptyState
            colSpan={visibleColumnCount}
            variant="error"
            title={errorMessage}
            actionLabel={onRetry ? "Reintentar" : undefined}
            onAction={onRetry}
          />
        ) : isLoading ? (
          <TableEmptyState colSpan={visibleColumnCount} variant="loading" title={loadingMessage} />
        ) : rows.length === 0 ? (
          <TableEmptyState colSpan={visibleColumnCount} variant="empty" title={emptyMessage} />
        ) : rows.map((row) => (
          <TableRow key={row.id} className={rowClassName}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(cell.column.columnDef.meta?.cellClassName, cellClassName)}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {Array.from({ length: emptyRowsToRender }).map((_, index) => (
          <TableRow
            key={`filler-row-${index}`}
            aria-hidden="true"
            className={cn("pointer-events-none hover:bg-transparent", rowClassName)}
          >
            {table.getVisibleLeafColumns().map((column, cellIndex) => (
              <TableCell
                key={`filler-cell-${index}-${cellIndex}`}
                className={cn(
                  column.columnDef.meta?.cellClassName,
                  cellClassName,
                  "h-full select-none text-transparent",
                )}
              >
                &nbsp;
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
