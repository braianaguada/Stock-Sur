import { EntityDialog } from "@/components/common/EntityDialog";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/DataTable";
import type { Customer, CustomerAccountEntry, CustomerAccountSummary } from "../types";

type Props = {
  open: boolean;
  customer: Customer | null;
  summary: CustomerAccountSummary | null;
  movements: CustomerAccountEntry[];
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerAccountDialog({ open, customer, summary, movements, isLoading, onOpenChange }: Props) {
  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title={customer ? `Cuenta corriente · ${customer.name}` : "Cuenta corriente"} contentClassName="sm:max-w-4xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Saldo</div>
            <div className="text-2xl font-semibold">{summary ? summary.balance.toFixed(2) : "0.00"}</div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Movimientos</div>
            <div className="text-2xl font-semibold">{summary?.movements_count ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Ultimo movimiento</div>
            <div className="text-sm font-medium">
              {summary?.last_movement_at ? new Date(summary.last_movement_at).toLocaleDateString("es-AR") : "-"}
            </div>
          </div>
        </div>
        <DataTable
          columns={[
            { accessorKey: "business_date", header: () => "Fecha" },
            {
              accessorKey: "entry_type",
              header: () => "Tipo",
              cell: ({ row }) => <Badge variant={row.original.entry_type === "DEBIT" ? "destructive" : "default"}>{row.original.entry_type}</Badge>,
            },
            { accessorKey: "origin_type", header: () => "Origen" },
            { accessorKey: "description", header: () => "Descripcion" },
            { accessorKey: "amount", header: () => "Importe", cell: ({ row }) => Number(row.original.amount).toFixed(2) },
          ]}
          data={movements}
          isLoading={isLoading}
          emptyMessage="Sin movimientos"
        />
      </div>
    </EntityDialog>
  );
}
