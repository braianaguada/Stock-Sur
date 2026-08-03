import { memo, useMemo } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { CopyPlus, Package, PackageX, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTableColumnHeader } from "@/components/data-table/DataTableColumnHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryBadge, HealthBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
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
  onDuplicate: (item: Item) => void;
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
      <HealthBadge tone="muted" className="gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        S/D
      </HealthBadge>
    );
  }
  
  if (total <= 0) {
    return (
      <HealthBadge tone="danger" className="gap-1">
        <PackageX className="h-2.5 w-2.5" /> Sin stock
      </HealthBadge>
    );
  }

  // Basic health logic: highlight low stock based on demand
  const isHighDemand = demand === "HIGH";
  const isMediumDemand = demand === "MEDIUM";
  const isCritical = (isHighDemand && total < 15) || (isMediumDemand && total < 5) || total < 2;

  if (isCritical) {
    return (
      <HealthBadge tone="warning" className="gap-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
        {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })} (Bajo)
      </HealthBadge>
    );
  }

  return (
    <HealthBadge tone="success" className="gap-1">
      <Package className="h-2.5 w-2.5" /> {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
    </HealthBadge>
  );
}

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

function operationalStatus(meta: ItemOperationalMeta | undefined, demand?: string | null) {
  const stock = meta?.stock;
  const baseCost = meta?.base_cost;
  const mainPrice = meta?.main_price;
  const issues: string[] = [];

  if (baseCost === null || baseCost === undefined || baseCost <= 0) {
    issues.push("costo");
  }
  if (mainPrice === null || mainPrice === undefined || mainPrice <= 0) {
    issues.push("precio");
  }
  if (stock === null || stock === undefined || stock <= 0) {
    issues.push("stock");
  } else {
    const isLow = (demand === "HIGH" && stock < 15) || (demand === "MEDIUM" && stock < 5) || stock < 2;
    if (isLow) issues.push("stock bajo");
  }

  if (issues.length === 0) {
    return {
      label: "OK",
      detail: "Sin alertas operativas",
      tone: "success" as const,
    };
  }

  const label = issues.length === 1 ? issues[0] : `${issues.length} alertas`;
  const hasBlockingIssue = issues.some((issue) => issue !== "stock bajo");

  return {
    label,
    detail: issues.map((issue) => (issue === "stock bajo" ? "Stock bajo" : `Sin ${issue}`)).join(", "),
    tone: hasBlockingIssue ? "danger" as const : "warning" as const,
  };
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
  onDuplicate,
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
        <PrimaryCell
          title={<OverflowTooltip text={row.original.name} className="block truncate" />}
          metadata={row.original.attributes ? <OverflowTooltip text={row.original.attributes} className="block truncate" /> : undefined}
        />
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
        return <MoneyCell value={formatMoney(meta?.base_cost)} format="plain" />;
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
        const status = operationalStatus(meta, row.original.demand_profile);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex max-w-[94px]">
                <HealthBadge tone={status.tone} className="max-w-full justify-center truncate">
                  {status.label}
                </HealthBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-56">
              <p>{status.detail}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
      meta: {
        className: "w-[112px]",
        cellClassName: "py-1",
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
        <CategoryBadge>
          {row.original.demand_profile === "HIGH" ? "Alta" : row.original.demand_profile === "MEDIUM" ? "Media" : "Baja"}
        </CategoryBadge>
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
        <StatusBadge tone={row.original.is_active ? "success" : "muted"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </StatusBadge>
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
          <RowActionButton label="Duplicar ítem" onClick={() => onDuplicate(row.original)}>
            <CopyPlus className="h-3.5 w-3.5" />
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
  ], [allVisibleSelected, items, onDelete, onDuplicate, onEdit, onRestore, onSelectionChange, onSort, operationalMetaByItemId, selectedItemIds, sortBy, sortDirection, stockByItemId]);

  return (
    <>
      <div data-testid="items-mobile-list" className="grid gap-3 lg:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" role="status">
            Cargando ítems...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No se encontraron ítems
          </div>
        ) : items.map((item) => {
          const meta = operationalMetaByItemId.get(item.id);
          const status = operationalStatus(meta, item.demand_profile);
          const isSelected = selectedItemIds.includes(item.id);

          return (
            <article key={item.id} data-testid="item-mobile-card" className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelectionChange(
                    checked === true
                      ? (isSelected ? selectedItemIds : [...selectedItemIds, item.id])
                      : selectedItemIds.filter((id) => id !== item.id),
                  )}
                  aria-label={`Seleccionar ${item.name}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{item.sku}</p>
                    </div>
                    <StatusBadge tone={item.is_active ? "success" : "muted"} className="shrink-0">
                      {item.is_active ? "Activo" : "Inactivo"}
                    </StatusBadge>
                  </div>
                  {(item.brand || item.category) ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {[item.brand, item.category].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/35 p-2 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Stock</p>
                  <div className="mt-1">{stockChip(stockByItemId.get(item.id), item.demand_profile)}</div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado operativo</p>
                  <span title={status.detail}>
                    <HealthBadge tone={status.tone} className="mt-1 max-w-full truncate">
                      {status.label}
                    </HealthBadge>
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Costo base</p>
                  <p className="mt-0.5 font-medium">{formatMoney(meta?.base_cost)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Margen</p>
                  <p className="mt-0.5 font-medium">{formatMargin(meta?.margin_pct)}</p>
                </div>
              </div>

              <div className="mt-3 flex justify-end border-t pt-2">
                <RowActions align="end">
                  <RowActionButton label="Duplicar ítem" onClick={() => onDuplicate(item)}>
                    <CopyPlus className="h-3.5 w-3.5" />
                  </RowActionButton>
                  <RowActionButton label="Editar" tone="edit" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </RowActionButton>
                  {item.is_active ? (
                    <RowActionButton label="Desactivar" tone="danger" onClick={() => onDelete(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </RowActionButton>
                  ) : (
                    <RowActionButton label="Reactivar" tone="success" onClick={() => onRestore(item.id)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </RowActionButton>
                  )}
                </RowActions>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          loadingMessage="Cargando..."
          emptyMessage="No se encontraron ítems"
          className="min-w-[1180px] table-fixed"
          sorting={sorting}
          columnVisibility={columnVisibility}
          rowClassName="h-11"
          cellClassName="h-11 py-1"
          reserveEmptyRows={pageSize}
        />
      </div>
    </>
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
