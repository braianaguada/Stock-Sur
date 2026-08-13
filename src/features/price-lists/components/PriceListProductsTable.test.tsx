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
  final_price_override: null,
  manual_price_enabled: false,
  manual_price_note: null,
  manual_price_updated_at: null,
  manual_price_updated_by: null,
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

  it("shows product override as the operational price without rounding", () => {
    render(
      <TooltipProvider>
        <PriceListProductsTable
          rows={[{ ...row, final_price_override: 2100, manual_price_enabled: true }]}
          columnVisibility={{}}
          priceRoundingConfig={{ enabled: true, increment: 500 }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("$2.100,00")).toBeInTheDocument();
    expect(screen.getByText("Personalizado")).toBeInTheDocument();
    expect(screen.getByText("Formula: $1.256,35")).toBeInTheDocument();
  });

  it("shows gross margin over net sales instead of markup including tax", () => {
    render(
      <TooltipProvider>
        <PriceListProductsTable
          rows={[{ ...row, base_cost: 1000, calculated_price: 1452 }]}
          columnVisibility={{}}
          freightPct={10}
          taxPct={10}
          priceRoundingConfig={{ enabled: false, increment: null }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("Margen bruto")).toBeInTheDocument();
    expect(screen.getByText("16,7%")).toBeInTheDocument();
  });
});
