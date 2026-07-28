import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockMovementDialog } from "./StockMovementDialog";
import type { SearchableItem, StockMovementForm } from "@/features/stock/types";

const form: StockMovementForm = {
  item_id: "",
  type: "IN",
  adjustment_direction: "ADD",
  quantity: "",
  reference: "",
};

const item: SearchableItem = {
  id: "item-1",
  name: "Filtro de aceite",
  sku: "FIL-01",
  unit: "UN",
  supplier: null,
  brand: "Marca",
  model: null,
  attributes: null,
  category: null,
};

describe("StockMovementDialog", () => {
  it("starts with only the product search control", () => {
    render(
      <StockMovementDialog
        open
        form={form}
        itemSearch=""
        availableItems={[]}
        stockByItemId={new Map()}
        selectedItem={null}
        searchingItems={false}
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onFormChange={vi.fn()}
        onItemSearchChange={vi.fn()}
        onSelectedItemChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/Buscar por nombre/)).toBeInTheDocument();
    expect(screen.queryByText(/Escribe para buscar/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No hay ítems/)).not.toBeInTheDocument();
  });

  it("selects a search result and clears the search inside the unified control", () => {
    const onFormChange = vi.fn();
    const onItemSearchChange = vi.fn();
    const onSelectedItemChange = vi.fn();

    render(
      <StockMovementDialog
        open
        form={form}
        itemSearch="filtro"
        availableItems={[item]}
        stockByItemId={new Map([["item-1", 12]])}
        selectedItem={null}
        searchingItems={false}
        isSaving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onFormChange={onFormChange}
        onItemSearchChange={onItemSearchChange}
        onSelectedItemChange={onSelectedItemChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filtro de aceite/ }));

    expect(onSelectedItemChange).toHaveBeenCalledWith(item);
    expect(onFormChange).toHaveBeenCalledWith({ ...form, item_id: "item-1" });
    expect(onItemSearchChange).toHaveBeenCalledWith("");
  });
});
