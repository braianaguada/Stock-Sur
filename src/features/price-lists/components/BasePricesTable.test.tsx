import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { BasePricesTable } from "@/features/price-lists/components/BasePricesTable";
import type { BasePriceRow } from "@/features/price-lists/types";

vi.mock("@/components/data-table/DataTable", () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: Array<{
      accessorKey?: string;
      header?: unknown;
      cell?: (context: { row: { original: BasePriceRow } }) => React.ReactNode;
    }>;
    data: BasePriceRow[];
  }) => (
    <table>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={String(column.accessorKey ?? index)}>
              {typeof column.header === "function" ? column.header({} as never) : null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.item_id}>
            {columns.map((column, index) => (
              <td key={String(column.accessorKey ?? index)}>
                {column.cell ? column.cell({ row: { original: row } }) : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const rows: BasePriceRow[] = [
  {
    item_id: "item-1",
    sku: "SKU-1",
    name: "Producto 1",
    brand: "Marca",
    model: "Modelo",
    category: "Categoría",
    previous_base_cost: 100,
    base_cost: 120,
    cost_variation_pct: 20,
    updated_at: "2026-04-07T00:00:00.000Z",
    updated_by: "user-1",
  },
];

describe("BasePricesTable", () => {
  it("permite escribir varios digitos sin cortar el valor", () => {
    const onSaveDraftValue = vi.fn();

    render(
      <BasePricesTable
        rows={rows}
        isSaving={false}
        pageSize={10}
        renderUserName={() => "Usuario"}
        onSaveDraftValue={onSaveDraftValue}
      />,
    );

    const input = screen.getByDisplayValue("120");
    fireEvent.change(input, { target: { value: "14525" } });

    expect(input).toHaveValue(14525);
    expect(onSaveDraftValue).not.toHaveBeenCalled();
  });

  it("guarda al perder foco sin requerir enter", () => {
    const onSaveDraftValue = vi.fn();

    render(
      <BasePricesTable
        rows={rows}
        isSaving={false}
        pageSize={10}
        renderUserName={() => "Usuario"}
        onSaveDraftValue={onSaveDraftValue}
      />,
    );

    const input = screen.getByDisplayValue("120");
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.blur(input, { target: { value: "250" } });

    expect(onSaveDraftValue).toHaveBeenCalledWith("item-1", "250");
  });
});
