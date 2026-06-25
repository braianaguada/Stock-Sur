import { memo, useMemo } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { AlertTriangle, Check, Copy, Package, PackageX, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { TableBadge, type TableBadgeTone } from "@/components/common/TableBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Item, ItemOperationalMeta } from "@/features/items/types";

export type ItemSortField = "sku" | "name" | "supplier" | "brand" | "model" | "attributes" | "category" | "is_active" | "created_at" | "stock";
export type SortDirection = "asc" | "desc";

type ItemsDataTableProps = {
  items: Item[];
  isLoading: boolean;
  pageSize: number;
  selectedItemIds: string[];
  columnVisibility: Record<string, boolean>;
  sortBy: ItemSortField;
  sortDirection: SortDirection;
  /** Map of item_id → total stock quantity (from stock-current query) */
  stockByItemId: Map<string, number>;
  operationalMetaByItemId: Map<string, ItemOperationalMeta>;
  onSort: (field: ItemSortField) => void;
  onSelectionChange: (next: string[]) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore: (itemId: string) => void;
  onCopySku: (item: Item) => void;
};

const sortFieldByColumnId: Record<string, ItemSortField> = {
  sku: "sku",
  name: "name",
  supplier: "supplier",
  brand: "brand",
  model: "model",
  attributes: "attributes",
  category: "category",
  is_active: "is_active",
  stock: "stock",
};

function stockChip(total: number | undefined, demand?: string | null) {
  if (total === undefined) {
    return (
      <TableBadge>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        S/D
      </TableBadge>
    );
  }
  
  if (total <= 0) {
    return (
      <TableBadge tone="danger">
        <PackageX className="h-3 w-3" /> Sin stock
      </TableBadge>
    );
  }

  // Basic health logic: highlight low stock based on demand
  const isHighDemand = demand === "HIGH";
  const isMediumDemand = demand === "MEDIUM";
  const isCritical = (isHighDemand && total < 15) || (isMediumDemand && total < 5) || total < 2;

  if (isCritical) {
    return (
      <TableBadge tone="warning">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
        {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })} (Bajo)
      </TableBadge>
    );
  }

  return (
    <TableBadge tone="success">
      <Package className="h-3 w-3" /> {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
    </TableBadge>
  );
}

const DEMAND_BADGE_TONE: Record<NonNullable<Item["demand_profile"]>, TableBadgeTone> = {
  HIGH: "primary",
  MEDIUM: "info",
  LOW: "neutral",
};

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMargin(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function operationalAlerts(meta: ItemOperationalMeta | undefined, demand?: string | null) {
  const stock = meta?.stock;
  const baseCost = meta?.base_cost;
  const mainPrice = meta?.main_price;
  const alerts: string[] = [];

  if (baseCost === null || baseCost === undefined || baseCost <= 0) {
    alerts.push("Sin costo");
  }
  if (mainPrice === null || mainPrice === undefined || mainPrice <= 0) {
    alerts.push("Sin precio");
  }
  if (stock === null || stock === undefined || stock <= 0) {
    alerts.push("Sin stock");
  } else {
    const isLow = (demand === "HIGH" && stock < 15) || (demand === "MEDIUM" && stock < 5) || stock < 2;
    if (isLow) alerts.push("Stock bajo");
  }

  return alerts;
}

function ItemsDataTableComponent({
  items,
  isLoading,
  pageSize,
  selectedItemIds,
  columnVisibility,
  sortBy,
  sortDirection,
  stockByItemId,
  operationalMetaByItemId,
  onSort,
  onSelectionChange,
  onEdit,
  onDelete,
  onRestore,
  onCopySku,
}: ItemsDataTableProps) {
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedItemIds.includes(item.id));

  const sorting = useMemo<SortingState>(() => {
    const columnId = Object.entries(sortFieldByColumnId).find(([, field]) => field === sortBy)?.[0];
    return columnId ? [{ id: columnId, desc: sortDirection === "desc" }] : [];
  }, [sortBy, sortDirection]);

  const columns = useMemo<ColumnDef<Item, unknown>[]>(() => [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={allVisibleSelected}
          onCheckedChange={(checked) => onSelectionChange(checked === true ? items.map((item) => item.id) : [])}
          aria-label="Seleccionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedItemIds.includes(row.original.id)}
          onCheckedChange={(checked) => onSelectionChange(
            checked === true
              ? (selectedItemIds.includes(row.original.id) ? selectedItemIds : [...selectedItemIds, row.original.id])
              : selectedItemIds.filter((id) => id !== row.original.id),
          )}
          aria-label={`Seleccionar ${row.original.name}`}
        />
      ),
      meta: {
        className: "w-[44px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "sku",
      header: () => (
        <DataTableColumnHeader
          title="SKU"
          sorted={sortBy === "sku" ? sortDirection : false}
          onToggleSort={() => onSort("sku")}
        />
      ),
      cell: ({ row }) => <span className="block truncate font-mono text-[11px]">{row.original.sku}</span>,
      meta: {
        className: "w-[130px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "name",
      header: () => (
        <DataTableColumnHeader
          title="Nombre"
          sorted={sortBy === "name" ? sortDirection : false}
          onToggleSort={() => onSort("name")}
        />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <OverflowTooltip text={row.original.name} className="block truncate text-sm font-medium" />
          {row.original.attributes ? (
            <OverflowTooltip
              text={row.original.attributes}
              className="mt-0.5 block truncate text-[11px] text-muted-foreground"
            />
          ) : null}
        </div>
      ),
      meta: {
        className: "w-[300px]",
        cellClassName: "py-1.5",
      },
    },
    {
      id: "stock",
      header: () => (
        <DataTableColumnHeader
          title="Stock"
          sorted={sortBy === "stock" ? sortDirection : false}
          onToggleSort={() => onSort("stock")}
        />
      ),
      cell: ({ row }) => {
        const total = stockByItemId.get(row.original.id);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{stockChip(total, row.original.demand_profile)}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {total === undefined ? "No se registró stock para este ítem" : `${total} unidades en stock`}
            </TooltipContent>
          </Tooltip>
        );
      },
      meta: {
        className: "w-[130px]",
        cellClassName: "py-1.5",
      },
    },
    {
      id: "base_cost",
      header: () => "Costo base",
      cell: ({ row }) => {
        const meta = operationalMetaByItemId.get(row.original.id);
        return <span className="block text-right text-xs font-medium">{formatMoney(meta?.base_cost)}</span>;
      },
      meta: {
        className: "w-[120px]",
        cellClassName: "py-1.5",
      },
    },
    {
      id: "margin_pct",
      header: () => "Margen",
      cell: ({ row }) => {
        const meta = operationalMetaByItemId.get(row.original.id);
        return <span className="block text-right text-xs">{formatMargin(meta?.margin_pct)}</span>;
      },
      meta: {
        className: "w-[90px]",
        cellClassName: "py-1.5",
      },
    },
    {
      id: "operational_status",
      header: () => "Estado operativo",
      cell: ({ row }) => {
        const meta = operationalMetaByItemId.get(row.original.id);
        const alerts = operationalAlerts(meta, row.original.demand_profile);
        if (alerts.length === 0) {
          return (
            <TableBadge tone="success">
              <Check className="h-2.5 w-2.5" />
              OK
            </TableBadge>
          );
        }

        const label = alerts.length === 1 ? alerts[0] : `${alerts.length} alertas`;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <TableBadge tone="warning" className="cursor-default">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {label}
                </TableBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {alerts.join(" · ")}
            </TooltipContent>
          </Tooltip>
        );
      },
      meta: {
        className: "w-[170px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "supplier",
      header: () => (
        <DataTableColumnHeader
          title="Proveedor"
          sorted={sortBy === "supplier" ? sortDirection : false}
          onToggleSort={() => onSort("supplier")}
        />
      ),
      cell: ({ row }) => <span className="block truncate text-xs">{row.original.supplier ?? "-"}</span>,
      meta: {
        className: "w-[140px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "brand",
      header: () => (
        <DataTableColumnHeader
          title="Marca"
          sorted={sortBy === "brand" ? sortDirection : false}
          onToggleSort={() => onSort("brand")}
        />
      ),
      cell: ({ row }) => <span className="block truncate text-xs">{row.original.brand ?? "-"}</span>,
      meta: {
        className: "w-[120px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "model",
      header: () => (
        <DataTableColumnHeader
          title="Modelo"
          sorted={sortBy === "model" ? sortDirection : false}
          onToggleSort={() => onSort("model")}
        />
      ),
      cell: ({ row }) => <span className="block truncate text-xs">{row.original.model ?? "-"}</span>,
      meta: {
        className: "w-[120px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "attributes",
      header: () => (
        <DataTableColumnHeader
          title="Atributos"
          sorted={sortBy === "attributes" ? sortDirection : false}
          onToggleSort={() => onSort("attributes")}
        />
      ),
      cell: ({ row }) => <span className="block truncate text-xs text-muted-foreground">{row.original.attributes ?? "-"}</span>,
      meta: {
        className: "w-[200px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "category",
      header: () => (
        <DataTableColumnHeader
          title="Categoría"
          sorted={sortBy === "category" ? sortDirection : false}
          onToggleSort={() => onSort("category")}
        />
      ),
      cell: ({ row }) => <span className="block truncate text-xs">{row.original.category ?? "-"}</span>,
      meta: {
        className: "w-[150px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "unit",
      header: () => "Unidad",
      cell: ({ row }) => <span className="text-xs">{row.original.unit}</span>,
      meta: {
        className: "w-[80px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "demand_profile",
      header: () => "Demanda",
      cell: ({ row }) => (
        <TableBadge tone={DEMAND_BADGE_TONE[row.original.demand_profile]}>
          {row.original.demand_profile === "HIGH" ? "Alta" : row.original.demand_profile === "MEDIUM" ? "Media" : "Baja"}
        </TableBadge>
      ),
      meta: {
        className: "w-[100px]",
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "is_active",
      header: () => (
        <DataTableColumnHeader
          title="Activo"
          sorted={sortBy === "is_active" ? sortDirection : false}
          onToggleSort={() => onSort("is_active")}
        />
      ),
      cell: ({ row }) => (
        <TableBadge tone={row.original.is_active ? "success" : "neutral"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </TableBadge>
      ),
      meta: {
        className: "w-[96px]",
        cellClassName: "py-1.5",
      },
    },
    {
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => (
        <RowActions align="start">
          <RowActionButton label="Copiar SKU" onClick={() => onCopySku(row.original)}>
            <Copy className="h-3.5 w-3.5" />
          </RowActionButton>
          <RowActionButton label="Editar" tone="edit" onClick={() => onEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </RowActionButton>
          {row.original.is_active ? (
            <RowActionButton label="Desactivar" tone="danger" onClick={() => onDelete(row.original)}>
              <Trash2 className="h-3.5 w-3.5" />
            </RowActionButton>
          ) : (
            <RowActionButton label="Reactivar" tone="success" onClick={() => onRestore(row.original.id)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </RowActionButton>
          )}
        </RowActions>
      ),
      meta: {
        className: "w-[180px]",
        cellClassName: "py-1.5",
      },
    },
  ], [allVisibleSelected, items, onCopySku, onDelete, onEdit, onRestore, onSelectionChange, onSort, operationalMetaByItemId, selectedItemIds, sortBy, sortDirection, stockByItemId]);

  return (
    <div className="overflow-x-auto">
      <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      loadingMessage="Cargando..."
      emptyMessage="No se encontraron ítems"
      className="table-fixed min-w-[1180px]"
      sorting={sorting}
      columnVisibility={columnVisibility}
      rowClassName="h-12"
      cellClassName="h-12 py-1.5"
      reserveEmptyRows={pageSize}
      />
    </div>
  );
}

export const ItemsDataTable = memo(ItemsDataTableComponent, (prev, next) => (
  prev.items === next.items
  && prev.isLoading === next.isLoading
  && prev.pageSize === next.pageSize
  && prev.selectedItemIds === next.selectedItemIds
  && prev.columnVisibility === next.columnVisibility
  && prev.sortBy === next.sortBy
  && prev.sortDirection === next.sortDirection
  && prev.stockByItemId === next.stockByItemId
  && prev.operationalMetaByItemId === next.operationalMetaByItemId
));
