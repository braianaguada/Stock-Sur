import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
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
import { cn } from "@/lib/utils";

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  emptyMessage: string;
  isLoading?: boolean;
  loadingMessage?: string;
  className?: string;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  columnVisibility?: VisibilityState;
  rowClassName?: string;
  reserveEmptyRows?: number;
};

export function DataTable<TData>({
  columns,
  data,
  emptyMessage,
  isLoading = false,
  loadingMessage = "Cargando...",
  className,
  sorting,
  onSortingChange,
  columnVisibility,
  rowClassName,
  reserveEmptyRows = 0,
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
    <Table className={className}>
      <TableHeader>
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
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={visibleColumnCount} className="py-6 text-center text-muted-foreground">
              {loadingMessage}
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={visibleColumnCount} className="py-6 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : rows.map((row) => (
          <TableRow key={row.id} className={rowClassName}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className={cn(cell.column.columnDef.meta?.cellClassName)}>
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
            {Array.from({ length: visibleColumnCount }).map((__, cellIndex) => (
              <TableCell key={`filler-cell-${index}-${cellIndex}`} className="select-none text-transparent">
                &nbsp;
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
