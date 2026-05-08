import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PriceListProductsTable } from "@/features/price-lists/components/PriceListProductsTable";
import type { PriceListProductRow } from "@/features/price-lists/types";

const row: PriceListProductRow = {
  item_id: "item-1",
  sku: "SKU-1",
  name: "Producto prueba",
  attributes: null,
  brand: null,
  model: null,
  category: null,
  unit: "un",
  previous_base_cost: null,
  base_cost: 1000,
  cost_variation_pct: null,
  calculated_price: 1256.35,
  needs_recalculation: false,
  last_calculated_at: null,
  last_calculated_by: null,
};

function renderTable(priceRoundingConfig: { enabled: boolean; increment: number | null }) {
  return render(
    <TooltipProvider>
      <PriceListProductsTable
        rows={[row]}
        columnVisibility={{}}
        priceRoundingConfig={priceRoundingConfig}
      />
    </TooltipProvider>,
  );
}

describe("PriceListProductsTable", () => {
  it("shows the rounded operational price when rounding is enabled", () => {
    renderTable({ enabled: true, increment: 500 });

    expect(screen.getByText("$1.500,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Redondeado desde $1.256,35")).toBeInTheDocument();
    expect(screen.getByText("Original $1.256,35")).toBeInTheDocument();
  });

  it("shows the original list price when rounding is disabled", () => {
    renderTable({ enabled: false, increment: 500 });

    expect(screen.getByText("$1.256,35")).toBeInTheDocument();
    expect(screen.queryByText("Redondeado")).not.toBeInTheDocument();
  });

  it("does not mutate the persisted price row while rendering", () => {
    renderTable({ enabled: true, increment: 500 });

    expect(row.calculated_price).toBe(1256.35);
  });
});
