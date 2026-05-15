import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, NotebookText } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { AmountDisplay, CompactBadge, OperationalTableShell } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL, RECEIPT_LABEL, STATUS_CLASS, STATUS_LABEL } from "../constants";
import type { CashSaleRow, SituationFilter } from "../types";
import { getClosureSituationWithClosure } from "../utils";

type CashSalesTabProps = {
  filteredSales: CashSaleRow[];
  salesLoading: boolean;
  situationFilter: SituationFilter;
  onSituationFilterChange: (value: SituationFilter) => void;
  effectiveClosure: { status: string; closed_at: string | null } | null;
  onOpenDetail: (sale: CashSaleRow) => void;
  onCancelSale: (saleId: string) => void;
  canCancelSale: (sale: CashSaleRow) => boolean;
  cancelPending: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (pageSize: number) => void;
};

export function CashSalesTab({
  filteredSales,
  salesLoading,
  situationFilter,
  onSituationFilterChange,
  effectiveClosure,
  onOpenDetail,
  onCancelSale,
  canCancelSale,
  cancelPending,
  page,
  totalPages,
  totalItems,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: CashSalesTabProps) {
  const columns = useMemo<ColumnDef<CashSaleRow, unknown>[]>(() => [
    {
      accessorKey: "sold_at",
      header: () => "Hora",
      cell: ({ row }) => <span className="font-mono text-xs">{formatTime(row.original.sold_at)}</span>,
      meta: { className: "w-[78px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "amount_total",
      header: () => <div className="text-right">Importe</div>,
      cell: ({ row }) => (
        <AmountDisplay value={Number(row.original.amount_total)} size="sm" className="text-right" />
      ),
      meta: { className: "w-[132px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "customer_name_snapshot",
      header: () => "Cliente",
      cell: ({ row }) => (
        <div className="max-w-[160px]">
          <p className="truncate text-sm font-medium">{row.original.customer_name_snapshot ?? "Consumidor final"}</p>
        </div>
      ),
      meta: { className: "w-[170px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "payment_method",
      header: () => "Pago",
      cell: ({ row }) => <span className="text-sm">{PAYMENT_LABEL[row.original.payment_method]}</span>,
      meta: { className: "w-[150px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "receipt_kind",
      header: () => "Comprobante",
      cell: ({ row }) => (
        <div className="min-w-0 text-sm">
          <p className="truncate">{RECEIPT_LABEL[row.original.receipt_kind]}</p>
          <Badge variant="outline" className={`${STATUS_CLASS[row.original.status]} mt-1 max-w-full`}>
            {STATUS_LABEL[row.original.status]}
          </Badge>
          {row.original.receipt_reference ? <p className="truncate font-mono text-xs text-muted-foreground">{row.original.receipt_reference}</p> : null}
        </div>
      ),
      meta: { className: "w-[160px]", cellClassName: "py-2.5" },
    },
    {
      id: "closure_situation",
      header: () => "Situacion",
      cell: ({ row }) => {
        const closureSituation = getClosureSituationWithClosure(row.original, effectiveClosure);
        return (
          <Badge variant="outline" className={closureSituation.className}>
            {closureSituation.label}
          </Badge>
        );
      },
      meta: { className: "w-[150px]", cellClassName: "py-2.5" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenDetail(row.original)}>
            <NotebookText className="h-4 w-4" />
          </Button>
          {row.original.status !== "ANULADA" ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => onCancelSale(row.original.id)}
              disabled={cancelPending || !canCancelSale(row.original)}
            >
              <Ban className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
      meta: { className: "w-[92px]", cellClassName: "py-2.5" },
    },
  ], [cancelPending, canCancelSale, effectiveClosure, onCancelSale, onOpenDetail]);

  return (
    <OperationalTableShell
      title="Movimientos del dia"
      description="Control principal de ventas cargadas, medio de pago y situacion de cierre."
      count={totalItems}
      actions={(
        <>
          <CompactBadge tone={effectiveClosure?.status === "CERRADO" ? "success" : "warning"}>
            {effectiveClosure?.status === "CERRADO" ? "Caja cerrada" : "Pendiente de cierre"}
          </CompactBadge>
          <Select value={situationFilter} onValueChange={(value) => onSituationFilterChange(value as SituationFilter)}>
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="PENDIENTE_CIERRE">Pendiente de cierre</SelectItem>
              <SelectItem value="EN_CAJA_CERRADA">En caja cerrada</SelectItem>
              <SelectItem value="POST_CIERRE">Venta post cierre</SelectItem>
              <SelectItem value="ANULADA">Anuladas</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    >
      {salesLoading || filteredSales.length > 0 ? (
        <div className="max-h-[560px] overflow-y-auto rounded-xl border">
          <DataTable
            columns={columns}
            data={filteredSales}
            isLoading={salesLoading}
            loadingMessage="Cargando ventas..."
            emptyMessage="Todavia no hay ventas registradas para esta fecha."
            className="table-fixed"
            rowClassName="h-11"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 bg-[hsl(var(--panel))]/32 p-8 text-center">
          <p className="text-base font-semibold text-foreground">Sin movimientos cargados</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Cuando registres una venta para esta fecha, va a aparecer aca con su importe, medio de pago y estado de cierre.
          </p>
        </div>
      )}
      {filteredSales.length > 0 ? (
        <div className="mt-4">
          <DataTablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            rangeStart={totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
            rangeEnd={totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems)}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            itemLabel="ventas"
          />
        </div>
      ) : null}
    </OperationalTableShell>
  );
}
