import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EntityDialog } from "@/components/common/EntityDialog";
import { MoneyCell, PrimaryCell } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { formatStockQuantity } from "@/lib/stock-quantity";
import { buildItemDisplayName } from "@/lib/item-display";
import { summarizeStockCostLots, type StockCostLot } from "../cost-lots";
import { useStockCostLots } from "../hooks/useStockCostLots";
import type { StockRow } from "../types";

const kindLabel: Record<StockCostLot["kind"], string> = {
  PURCHASE: "Compra", UNVALUED: "Ingreso sin costo", OPENING: "Saldo anterior", SHORTAGE: "Salida sin existencias",
};

export function StockCostLotsDialog({ companyId, item, onClose }: {
  companyId: string; item: StockRow; onClose: () => void;
}) {
  const { data = [], isLoading, error, refetch } = useStockCostLots(companyId, item.item_id);
  const [page, setPage] = useState(1);
  const pagination = usePaginationSlice({ items: data, page, pageSize: 10 });
  const totals = summarizeStockCostLots(data);
  const columns = useMemo<ColumnDef<StockCostLot, unknown>[]>(() => [
    { id: "purchase", header: "Ingreso", cell: ({ row: { original: lot } }) => (
      <PrimaryCell title={lot.supplier || kindLabel[lot.kind]}
        metadata={`${new Date(lot.acquired_at).toLocaleDateString("es-AR")} · ${kindLabel[lot.kind]}`} />
    ) },
    { id: "cost", header: "Costo sin IVA (ARS)", cell: ({ row }) => row.original.unit_cost_ars === null
      ? <span className="text-xs text-muted-foreground">Sin costo registrado</span> : <MoneyCell value={row.original.unit_cost_ars} /> },
    { id: "received", header: "Ingresado", cell: ({ row }) => formatStockQuantity(row.original.received_quantity, item.item_unit) },
    { id: "remaining", header: "Disponible", cell: ({ row }) => formatStockQuantity(row.original.remaining_quantity, item.item_unit) },
    { id: "value", header: "Valor disponible (ARS)", cell: ({ row }) => row.original.remaining_value_ars === null
      ? <span className="text-muted-foreground">—</span> : <MoneyCell value={row.original.remaining_value_ars} /> },
  ], [item.item_unit]);

  return <EntityDialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Compras y costos"
    description={buildItemDisplayName({ name: item.item_name, brand: item.item_brand, model: item.item_model, attributes: item.item_attributes })}
    contentClassName="sm:max-w-4xl">
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Las salidas consumen primero los lotes más antiguos (FIFO). Los costos se conservan por compra.</p>
      {error ? <div role="alert" className="text-sm text-destructive">No se pudieron cargar los costos: {error.message}. <Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div> : null}
      {!isLoading && !error ? <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>Valor con costo registrado: <MoneyCell value={totals.knownValue} /></span>
        <span>Sin costo: {formatStockQuantity(totals.unvaluedQuantity, item.item_unit)}</span>
        {totals.shortageQuantity > 0 ? <span className="text-destructive">Stock a compensar: {formatStockQuantity(totals.shortageQuantity, item.item_unit)}</span> : null}
      </div> : null}
      <DataTable columns={columns} data={error ? [] : pagination.pagedItems} isLoading={isLoading}
        emptyMessage={error ? "Costos no disponibles" : "Este producto todavía no tiene ingresos registrados"} density="compact" />
      <DataTablePagination page={pagination.page} totalPages={pagination.totalPages} totalItems={data.length}
        rangeStart={pagination.rangeStart} rangeEnd={pagination.rangeEnd} pageSize={10}
        onPageChange={setPage} itemLabel="lotes" />
    </div>
  </EntityDialog>;
}
