import { memo, useMemo } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Package, PackageX, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Item } from "@/features/items/types";

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
  onSort: (field: ItemSortField) => void;
  onSelectionChange: (next: string[]) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore: (itemId: string) => void;
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

function stockChip(total: number | undefined) {
  if (total === undefined) {
    return (
      <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-border/50 text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        Sin registro
      </Badge>
    );
  }
  if (total <= 0) {
    return (
      <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-destructive/40 bg-destructive/8 text-destructive">
        <PackageX className="h-2.5 w-2.5" /> Sin stock
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-emerald-500/40 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400">
      <Package className="h-2.5 w-2.5" /> {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
    </Badge>
  );
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
  onSort,
  onSelectionChange,
  onEdit,
  onDelete,
  onRestore,
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
              <span>{stockChip(total)}</span>
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
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {row.original.demand_profile === "HIGH" ? "Alta" : row.original.demand_profile === "MEDIUM" ? "Media" : "Baja"}
        </Badge>
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
        <Badge variant={row.original.is_active ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
          {row.original.is_active ? "Activo" : "Inactivo"}
        </Badge>
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
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {row.original.is_active ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(row.original)} title="Desactivar">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRestore(row.original.id)} title="Reactivar">
              <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
            </Button>
          )}
        </div>
      ),
      meta: {
        className: "w-[104px]",
        cellClassName: "py-1.5",
      },
    },
  ], [allVisibleSelected, items, onDelete, onEdit, onRestore, onSelectionChange, onSort, selectedItemIds, sortBy, sortDirection, stockByItemId]);

  return (
    <div className="overflow-x-auto">
      <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      loadingMessage="Cargando..."
      emptyMessage="No se encontraron ítems"
      className="table-fixed min-w-[1680px]"
      sorting={sorting}
      columnVisibility={columnVisibility}
      rowClassName="h-9"
      cellClassName="h-9 py-0"
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
));
