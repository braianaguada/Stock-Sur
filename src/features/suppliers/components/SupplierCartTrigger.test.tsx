import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SupplierCartItem } from "../pricing";
import { SupplierCartTrigger } from "./SupplierCartTrigger";

describe("supplier topbar cart", () => {
  it("previews only five products and opens the complete cart", () => {
    const onOpen = vi.fn();
    const items = Array.from({ length: 6 }, (_, index) => ({ supplierId: "s1", versionId: "v1", listName: "Lista", quantity: 1, line: { id: `l${index}`, raw_description: `Producto ${index}` } } as SupplierCartItem));
    render(<SupplierCartTrigger items={items} onOpen={onOpen} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Carrito de compras: 6 productos" }));
    const preview = screen.getByRole("region", { name: "Resumen del carrito" });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(5);
    expect(within(preview).queryByText("Producto 0")).not.toBeInTheDocument();
    fireEvent.click(within(preview).getByRole("button", { name: "Ver carrito" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("supports click and Escape with focus restored to the topbar trigger", () => {
    render(<SupplierCartTrigger items={[]} onOpen={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Carrito de compras: 0 productos" });
    fireEvent.click(trigger);
    const open = screen.getByRole("button", { name: "Hacer pedido" });
    open.focus();
    fireEvent.keyDown(open, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
