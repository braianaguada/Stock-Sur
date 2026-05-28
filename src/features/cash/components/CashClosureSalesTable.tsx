import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { currency, formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL, RECEIPT_LABEL } from "@/features/cash/constants";
import type { CashMovementRow } from "@/features/cash/types";

type CashClosureSalesTableProps = {
  movements: CashMovementRow[];
};

export function CashClosureSalesTable({ movements }: CashClosureSalesTableProps) {
  const columns = useMemo<ColumnDef<CashMovementRow, unknown>[]>(() => [
    {
      accessorKey: "sold_at",
      header: () => "Hora",
      cell: ({ row }) => formatTime(row.original.sold_at),
      meta: {
        className: "w-[96px]",
      },
    },
    {
      accessorKey: "customer_name_snapshot",
      header: () => "Cliente",
      cell: ({ row }) => row.original.customer_name_snapshot ?? "Consumidor final",
    },
    {
      accessorKey: "payment_method",
      header: () => "Pago",
      cell: ({ row }) => PAYMENT_LABEL[row.original.payment_method],
      meta: {
        className: "w-[160px]",
      },
    },
    {
      accessorKey: "receipt_reference",
      header: () => "Comprobante",
      cell: ({ row }) => row.original.receipt_reference ?? RECEIPT_LABEL[row.original.receipt_kind],
      meta: {
        className: "w-[180px]",
      },
    },
    {
      accessorKey: "display_amount",
      header: () => <div className="text-right">Importe</div>,
      cell: ({ row }) => (
        <div className={`text-right font-semibold ${row.original.display_amount < 0 ? "text-rose-700" : ""}`}>
          {currency.format(Number(row.original.display_amount))}
        </div>
      ),
      meta: {
        className: "w-[140px]",
        cellClassName: "text-right",
      },
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={movements}
      emptyMessage="Sin movimientos registrados en este cierre"
    />
  );
}
