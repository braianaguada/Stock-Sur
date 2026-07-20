import { render } from "@testing-library/react";
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
});
