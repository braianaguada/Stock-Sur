import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BasePricesTable } from "@/features/price-lists/components/BasePricesTable";
import type { BasePriceRow } from "@/features/price-lists/types";

const row: BasePriceRow = {
  item_id: "item-1",
  sku: "SKU-1",
  name: "Producto prueba",
  attributes: null,
  brand: null,
  model: null,
  category: null,
  unit: "un",
  previous_base_cost: null,
  base_cost: 0,
  cost_variation_pct: null,
  updated_at: null,
  updated_by: null,
};

describe("BasePricesTable", () => {
  it("allows replacing a zero base cost without keeping a leading zero", async () => {
    const user = userEvent.setup();
    const onSaveDraftValue = vi.fn();

    render(
      <TooltipProvider>
        <BasePricesTable
          rows={[row]}
          isSaving={false}
          pageSize={10}
          columnVisibility={{}}
          renderUserName={() => ""}
          onSaveDraftValue={onSaveDraftValue}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Cambiar costo base" }));

    const input = screen.getByLabelText("Nuevo costo");
    expect(input).toHaveValue(null);

    await user.type(input, "125");
    expect(input).toHaveValue(125);

    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSaveDraftValue).toHaveBeenCalledWith("item-1", 125);
  });
});
