import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Supplier } from "@/features/suppliers/types";
import { SuppliersTable } from "./SuppliersTable";

const supplier: Supplier = {
  id: "supplier-1",
  name: "Distribuidora Sur",
  contact_name: "Ana Pérez",
  email: "ana@example.com",
  phone: null,
  whatsapp: "5491112345678",
  legal_name: null,
  tax_id: null,
  address: null,
  default_currency: "ARS",
  notes: null,
  is_active: true,
};

describe("SuppliersTable", () => {
  it("renders the canonical directory and keeps operational actions accessible", () => {
    const onOpenCatalog = vi.fn();
    const onOpenEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <SuppliersTable
        suppliers={[supplier]}
        isLoading={false}
        onOpenCatalog={onOpenCatalog}
        onOpenEdit={onOpenEdit}
        onDelete={onDelete}
        onRestore={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Directorio de proveedores" })).toBeInTheDocument();
    expect(screen.getByText("1 registro")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Sur")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Catalogos" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    expect(onOpenCatalog).toHaveBeenCalledWith(supplier);
    expect(onOpenEdit).toHaveBeenCalledWith(supplier);
    expect(onDelete).toHaveBeenCalledWith(supplier);
  });
});
