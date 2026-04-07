import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, ClipboardCheck, Eye } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL } from "../constants";
import type { CashSaleRow } from "../types";

type CashPendingTabProps = {
  pendingSales: CashSaleRow[];
  onAssignReceipt: (sale: CashSaleRow) => void;
  onCancelSale: (saleId: string) => void;
  onOpenDetail: (sale: CashSaleRow) => void;
  canAttachReceipt: (sale: CashSaleRow) => boolean;
  canCancelSale: (sale: CashSaleRow) => boolean;
  cancelPending: boolean;
};

export function CashPendingTab({
  pendingSales,
  onAssignReceipt,
  onCancelSale,
  onOpenDetail,
  canAttachReceipt,
  canCancelSale,
  cancelPending,
}: CashPendingTabProps) {
  const columns = useMemo<ColumnDef<CashSaleRow, unknown>[]>(() => [
    {
      accessorKey: "sold_at",
      header: () => "Hora",
      cell: ({ row }) => <span className="font-mono text-xs">{formatTime(row.original.sold_at)}</span>,
      meta: { cellClassName: "py-2.5" },
    },
    {
      accessorKey: "customer_name_snapshot",
      header: () => "Cliente",
      cell: ({ row }) => row.original.customer_name_snapshot ?? "Consumidor final",
      meta: { cellClassName: "py-2.5" },
    },
    {
      accessorKey: "payment_method",
      header: () => "Pago",
      cell: ({ row }) => PAYMENT_LABEL[row.original.payment_method],
      meta: { cellClassName: "py-2.5" },
    },
    {
      accessorKey: "amount_total",
      header: () => <div className="text-right">Importe</div>,
      cell: ({ row }) => <div className="text-right font-semibold">{currency.format(Number(row.original.amount_total))}</div>,
      meta: { cellClassName: "py-2.5" },
    },
    {
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="icon" variant="outline" onClick={() => onAssignReceipt(row.original)} disabled={!canAttachReceipt(row.original)}>
            <ClipboardCheck className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive"
            onClick={() => onCancelSale(row.original.id)}
            disabled={cancelPending || !canCancelSale(row.original)}
          >
            <Ban className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => onOpenDetail(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: { className: "w-[220px]", cellClassName: "py-2.5" },
    },
  ], [canAttachReceipt, canCancelSale, cancelPending, onAssignReceipt, onCancelSale, onOpenDetail]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Pendientes de comprobante</CardTitle>
        <CardDescription>Ventas registradas que ya impactan en caja pero todavía no tienen remito o factura asignada.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[560px] overflow-auto rounded-lg border">
          <DataTable
            columns={columns}
            data={pendingSales}
            emptyMessage="No hay pendientes para esta fecha."
            rowClassName="h-11"
          />
        </div>
      </CardContent>
    </Card>
  );
}
