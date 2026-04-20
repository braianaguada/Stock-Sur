import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, FileDown, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/features/quotes/constants";
import { businessDateFromTimestamp } from "@/lib/formatters";
import type { QuoteListRow } from "@/features/quotes/types";

type QuotesTableProps = {
  quotes: QuoteListRow[];
  isLoading: boolean;
  onView: (quote: QuoteListRow) => void;
  onExport: (quote: QuoteListRow) => void;
  onDelete: (quote: QuoteListRow) => void;
};

export function QuotesTable({
  quotes,
  isLoading,
  onView,
  onExport,
  onDelete,
}: QuotesTableProps) {
  const columns = useMemo<ColumnDef<QuoteListRow, unknown>[]>(() => [
    {
      accessorKey: "quote_number",
      header: () => "#",
      cell: ({ row }) => <span className="font-mono">{row.original.quote_number}</span>,
    },
    {
      accessorKey: "customer_name",
      header: () => "Cliente",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customer_name ?? row.original.customers?.name ?? "-"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: () => "Estado",
      cell: ({ row }) => (
        <Badge variant={QUOTE_STATUS_VARIANTS[row.original.status] ?? "secondary"}>
          {QUOTE_STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          ${Number(row.original.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: () => "Fecha",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {businessDateFromTimestamp(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onView(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onExport(row.original)}>
            <FileDown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(row.original)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      meta: {
        className: "w-[120px]",
      },
    },
  ], [onDelete, onExport, onView]);

  return (
    <DataTable
      columns={columns}
      data={quotes}
      isLoading={isLoading}
      emptyMessage="No hay presupuestos"
    />
  );
}
