import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickPriceConsultationDialog } from "./QuickPriceConsultationDialog";
import type { PriceListProductRow, PriceListSummary } from "@/features/price-lists/types";
import { TooltipProvider } from "@/components/ui/tooltip";

const priceList: PriceListSummary = {
  id: "list-1",
  name: "Mostrador",
  description: null,
  flete_pct: 0,
  utilidad_pct: 30,
  impuesto_pct: 21,
  status: "UPDATED",
  last_recalculated_at: null,
  last_recalculated_by: null,
  updated_at: "2026-08-13T00:00:00.000Z",
  updated_by: null,
  created_at: "2026-08-13T00:00:00.000Z",
  created_by: null,
  pending_items_count: 1,
  total_items_count: 1,
};

const product: PriceListProductRow = {
  item_id: "item-1",
  sku: "COR-001",
  name: "Correa distribución",
  attributes: null,
  brand: "Demo",
  model: null,
  category: "Motor",
  unit: "UN",
  previous_base_cost: null,
  base_cost: 100,
  cost_variation_pct: null,
  calculated_price: 150,
  final_price_override: 175,
  manual_price_enabled: true,
  manual_price_note: null,
  manual_price_updated_at: null,
  manual_price_updated_by: null,
  needs_recalculation: true,
  last_calculated_at: null,
  last_calculated_by: null,
};

describe("QuickPriceConsultationDialog", () => {
  it("only shows matching products from the selected list with operational data", () => {
    render(
      <TooltipProvider><QuickPriceConsultationDialog
        open
        priceLists={[priceList]}
        selectedListId="list-1"
        products={[product]}
        stockByItemId={new Map([["item-1", 4]])}
        onOpenChange={vi.fn()}
        onSelectedListIdChange={vi.fn()}
      /></TooltipProvider>,
    );

    expect(screen.getByText(/Escribí al menos parte/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar producto para consultar" }), { target: { value: "COR-001" } });

    expect(screen.getByText("Correa distribución")).toBeInTheDocument();
    expect(screen.getByText("$175,00")).toBeInTheDocument();
    expect(screen.getByText("Personalizado")).toBeInTheDocument();
    expect(screen.getByText("Recalcular")).toBeInTheDocument();
  });

  it("does not leak unrelated products into the results", () => {
    render(
      <TooltipProvider><QuickPriceConsultationDialog
        open
        priceLists={[priceList]}
        selectedListId="list-1"
        products={[product]}
        stockByItemId={new Map()}
        onOpenChange={vi.fn()}
        onSelectedListIdChange={vi.fn()}
      /></TooltipProvider>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar producto para consultar" }), { target: { value: "bujía" } });
    expect(screen.getByText("No hay productos que coincidan en esta lista.")).toBeInTheDocument();
    expect(screen.queryByText("Correa distribución")).not.toBeInTheDocument();
  });
});
