import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";

type Row = { name: string };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Nombre" },
];

describe("DataTable visual contract", () => {
  it("supports compact density and an opt-in sticky header", () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[{ name: "Producto" }]}
        emptyMessage="Sin datos"
        density="compact"
        stickyHeader
      />,
    );

    expect(container.querySelector("table")).toHaveAttribute("data-density", "compact");
    expect(container.querySelector("thead")).toHaveClass("sticky", "top-0");
  });

  it("exposes distinct accessible loading, empty and error states", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} data={[]} emptyMessage="Sin datos" isLoading loadingMessage="Cargando productos" />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando productos")).toBeInTheDocument();

    rerender(<DataTable columns={columns} data={[]} emptyMessage="Sin datos" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "empty");

    rerender(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage="Sin datos"
        errorMessage="No pudimos cargar los productos"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los productos");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
