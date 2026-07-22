import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, FileText, MoreHorizontal, NotebookText, ReceiptText } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { CountBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogActionGrid, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTime } from "@/lib/formatters";
import { PAYMENT_LABEL, RECEIPT_LABEL, STATUS_LABEL } from "../constants";
import type { CashMovementRow, SituationFilter } from "../types";
import { getClosureSituationWithClosure } from "../utils";
import { canShowCreateBillingDraftAction } from "@/features/billing/lib/draft";

type CashSalesTabProps = {
  filteredSales: CashMovementRow[];
  salesLoading: boolean;
  situationFilter: SituationFilter;
  onSituationFilterChange: (value: SituationFilter) => void;
  effectiveClosure: { status: string; closed_at: string | null } | null;
  onOpenDetail: (sale: CashMovementRow) => void;
  onCancelSale: (saleId: string) => void;
  canCancelSale: (sale: CashMovementRow) => boolean;
  cancelPending: boolean;
  billingEnabled: boolean;
  billedSourceIds: ReadonlySet<string>;
  canCreateBillingDraft: boolean;
  onCreateBillingDraft: (sale: CashMovementRow) => void;
  onCreateInvoiceADraft: (sale: CashMovementRow) => void;
  getInvoiceAReadiness: (sale: CashMovementRow) => { allowed: boolean; reasons: string[] };
  createBillingDraftPending: boolean;
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
  billingEnabled,
  billedSourceIds,
  canCreateBillingDraft,
  onCreateBillingDraft,
  onCreateInvoiceADraft,
  getInvoiceAReadiness,
  createBillingDraftPending,
  page,
  totalPages,
  totalItems,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: CashSalesTabProps) {
  const columns = useMemo<ColumnDef<CashMovementRow, unknown>[]>(() => [
    {
      accessorKey: "sold_at",
      header: () => "Hora",
      cell: ({ row }) => <span className="font-mono text-xs">{formatTime(row.original.sold_at)}</span>,
      meta: { className: "w-[78px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "display_amount",
      header: () => <div className="text-right">Importe</div>,
      cell: ({ row }) => (
        <MoneyCell
          value={Number(row.original.display_amount)}
          size="sm"
          className={row.original.display_amount < 0 ? "text-right text-destructive" : "text-right"}
        />
      ),
      meta: { className: "w-[132px]", cellClassName: "py-2.5" },
    },
    {
      accessorKey: "customer_name_snapshot",
      header: () => "Cliente",
      cell: ({ row }) => (
        <PrimaryCell title={row.original.customer_name_snapshot ?? "Consumidor final"} className="max-w-[160px]" />
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
          <StatusBadge tone={row.original.status === "ANULADA" ? "danger" : "success"} className="mt-1 max-w-full">
            {STATUS_LABEL[row.original.status]}
          </StatusBadge>
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
          <StatusBadge tone={closureSituation.label === "En caja cerrada" ? "success" : closureSituation.label === "Anulada" ? "danger" : "warning"}>
            {closureSituation.label}
          </StatusBadge>
        );
      },
      meta: { className: "w-[150px]", cellClassName: "py-2.5" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => {
        const sale = row.original;
        const canDraft = canShowCreateBillingDraftAction({
          billingEnabled,
          canCreate: canCreateBillingDraft,
          sale,
          billedSourceIds,
        });
        const canCancel = sale.movement_kind === "SALE" && sale.status !== "ANULADA";
        return (
        <RowActions>
          <RowActionButton label="Ver detalle" tone="view" onClick={() => onOpenDetail(sale)}>
            <NotebookText className="h-4 w-4" />
          </RowActionButton>
          {canDraft || canCancel ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-10 w-10 rounded-lg" aria-label="Más acciones" title="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Acciones del movimiento</DialogTitle>
                  <DialogDescription>Elegí una acción para esta venta.</DialogDescription>
                </DialogHeader>
                <DialogActionGrid>
          {canDraft ? (
            <>
              <Button
                type="button"
                variant="ghost"
                aria-label="Crear borrador Factura B"
                title="Crear borrador Factura B"
                onClick={() => onCreateBillingDraft(row.original)}
                disabled={createBillingDraftPending}
              >
                <ReceiptText className="h-4 w-4" />
                <span>Crear borrador Factura B</span>
              </Button>
              {(() => {
                const readiness = getInvoiceAReadiness(sale);
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Crear borrador Factura A"
                    title={readiness.allowed ? "Crear borrador Factura A" : `Factura A bloqueada: ${readiness.reasons[0] ?? "cliente no elegible"}`}
                    onClick={() => onCreateInvoiceADraft(sale)}
                    disabled={createBillingDraftPending || !readiness.allowed}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Crear borrador Factura A</span>
                  </Button>
                );
              })()}
            </>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => onCancelSale(sale.id)}
              disabled={cancelPending || !canCancelSale(sale)}
            >
              <Ban className="h-4 w-4" />
              <span>Anular venta</span>
            </Button>
          ) : null}
                </DialogActionGrid>
              </DialogContent>
            </Dialog>
          ) : null}
        </RowActions>
        );
      },
      meta: { className: "w-[96px]", cellClassName: "py-2.5" },
    },
  ], [
    billedSourceIds,
    billingEnabled,
    cancelPending,
    canCancelSale,
    canCreateBillingDraft,
    createBillingDraftPending,
    effectiveClosure,
    onCancelSale,
    onCreateBillingDraft,
    onCreateInvoiceADraft,
    getInvoiceAReadiness,
    onOpenDetail,
  ]);

  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>Movimientos del día</CardTitle>
          <CardDescription>Control principal de ventas cargadas, medio de pago y situación de cierre.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CountBadge>{totalItems} {totalItems === 1 ? "movimiento" : "movimientos"}</CountBadge>
          <StatusBadge tone={effectiveClosure?.status === "CERRADO" ? "success" : "warning"}>
            {effectiveClosure?.status === "CERRADO" ? "Caja cerrada" : "Pendiente de cierre"}
          </StatusBadge>
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
        </div>
      </CardHeader>
      <CardContent>
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
            itemLabel="movimientos"
          />
        </div>
      ) : null}
      </CardContent>
    </Card>
  );
}
