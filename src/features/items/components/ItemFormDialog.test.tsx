import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemFormDialog } from "./ItemFormDialog";
import { createItemForm } from "../form";
vi.mock("./ItemSupplierSelect", () => ({ ItemSupplierSelect: () => <div>Seleccionar proveedor</div> }));
describe("ItemFormDialog", () => {
  it("keeps core fields visible and technical data inside a secondary section", () => {
    render(<ItemFormDialog companyId="company-1" aliasSupplierId="" onAliasSupplierChange={vi.fn()}
      open editingItem={null} form={createItemForm()} aliases={[]} newAlias="" isSupplierCode={false} isSaving={false}
      onOpenChange={vi.fn()} onSubmit={vi.fn()} onFormChange={vi.fn()} onGenerateSku={vi.fn()}
      onNewAliasChange={vi.fn()} onSupplierCodeChange={vi.fn()} onAddAlias={vi.fn()} onDeleteAlias={vi.fn()} />);
    const section = screen.getByText("Datos tecnicos y codigos alternativos").closest("details");
    expect(section).not.toHaveAttribute("open");
    expect(section).toContainElement(screen.getByText("Marca"));
    expect(section).toContainElement(screen.getByText("Modelo"));
    expect(section).not.toContainElement(screen.getByText("Nombre *"));
    expect(section).not.toContainElement(screen.getByText("Unidad *"));
    expect(section).not.toContainElement(screen.getByText("Proveedor"));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
  it("submits a duplicate with automatic code without pressing Autogenerar", () => {
    const onSubmit = vi.fn();
    const onGenerateSku = vi.fn();
    render(<ItemFormDialog companyId="company-1" aliasSupplierId="" onAliasSupplierChange={vi.fn()}
      open isDuplicating editingItem={null} form={{ ...createItemForm(), name: "Producto duplicado", sku: "" }}
      aliases={[]} newAlias="" isSupplierCode={false} isSaving={false}
      onOpenChange={vi.fn()} onSubmit={onSubmit} onFormChange={vi.fn()} onGenerateSku={onGenerateSku}
      onNewAliasChange={vi.fn()} onSupplierCodeChange={vi.fn()} onAddAlias={vi.fn()} onDeleteAlias={vi.fn()} />);
    expect(screen.getByPlaceholderText("Automatico al guardar")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onGenerateSku).not.toHaveBeenCalled();
  });
});
