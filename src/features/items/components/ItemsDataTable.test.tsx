import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ItemsDataTable } from "@/features/items/components/ItemsDataTable";
import type { Item, ItemOperationalMeta } from "@/features/items/types";

const item: Item = {
  id: "item-1",
  sku: "SKU-1",
  name: "Producto prueba",
  supplier: null,
  brand: null,
  model: null,
  attributes: null,
  unit: "un",
  category: null,
  demand_profile: "LOW",
  demand_monthly_estimate: null,
  is_active: true,
};

const meta: ItemOperationalMeta = {
  stock: 10,
  base_cost: 1000,
  main_price: 1500,
  main_price_original: 1256.35,
  main_price_list_name: "Lista A",
  margin_pct: 33.3,
};

function renderTable(operationalMeta = meta) {
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <ItemsDataTable
          items={[item]}
          isLoading={false}
          pageSize={10}
          selectedItemIds={[]}
          columnVisibility={{}}
          sortBy="name"
          sortDirection="asc"
          stockByItemId={new Map([["item-1", 10]])}
          operationalMetaByItemId={new Map([["item-1", operationalMeta]])}
          onSort={vi.fn()}
          onSelectionChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          onCopySku={vi.fn()}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("ItemsDataTable", () => {
  it("does not render the removed main price column", () => {
    renderTable();

    expect(screen.queryByText("Precio principal")).not.toBeInTheDocument();
    expect(screen.queryByText("$ 1.500")).not.toBeInTheDocument();
  });

  it("does not mutate the operational metadata source while rendering", () => {
    renderTable();

    expect(meta.main_price_original).toBe(1256.35);
    expect(meta.main_price).toBe(1500);
  });
});
