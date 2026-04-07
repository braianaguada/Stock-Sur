import { useMemo } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Item } from "@/features/items/types";

export type ItemSortField = "sku" | "name" | "brand" | "model" | "category" | "is_active" | "created_at";
export type SortDirection = "asc" | "desc";

type ItemsDataTableProps = {
  items: Item[];
  isLoading: boolean;
  selectedItemIds: string[];
  sortBy: ItemSortField;
  sortDirection: SortDirection;
  onSort: (field: ItemSortField) => void;
  onSelectionChange: (next: string[]) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onRestore: (itemId: string) => void;
};

const sortFieldByColumnId: Record<string, ItemSortField> = {
  sku: "sku",
  name: "name",
  brand: "brand",
  model: "model",
  category: "category",
  is_active: "is_active",
};

export function ItemsDataTable({
  items,
  isLoading,
  selectedItemIds,
  sortBy,
  sortDirection,
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
      cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.sku}</span>,
      meta: {
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
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
      meta: {
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
      cell: ({ row }) => <span className="text-xs">{row.original.brand ?? "-"}</span>,
      meta: {
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
      cell: ({ row }) => <span className="text-xs">{row.original.model ?? "-"}</span>,
      meta: {
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
      cell: ({ row }) => <span className="text-xs">{row.original.category ?? "-"}</span>,
      meta: {
        cellClassName: "py-1.5",
      },
    },
    {
      accessorKey: "unit",
      header: () => "Unidad",
      cell: ({ row }) => <span className="text-xs">{row.original.unit}</span>,
      meta: {
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
        className: "w-[120px]",
        cellClassName: "py-1.5",
      },
    },
  ], [allVisibleSelected, items, onDelete, onEdit, onRestore, onSelectionChange, onSort, selectedItemIds, sortBy, sortDirection]);

  return (
    <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      loadingMessage="Cargando..."
      emptyMessage="No se encontraron ítems"
      sorting={sorting}
      rowClassName="h-9"
    />
  );
}
