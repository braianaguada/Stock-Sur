import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupplierPurchaseOrder } from "@/features/purchase-orders/api";
import type { SupplierPurchaseOrder } from "@/features/purchase-orders/types";
import { fetchSupplier } from "../queries";
import type { Supplier } from "../types";
import type { SupplierCartItem } from "../pricing";
import { SupplierCart } from "./SupplierCart";

vi.mock("../queries", () => ({ fetchSupplier: vi.fn() }));
vi.mock("@/features/purchase-orders/api", () => ({ createSupplierPurchaseOrder: vi.fn() }));
const items: SupplierCartItem[] = [
  { supplierId: "s1", versionId: "v1", listName: "Lista 1", line: { id: "l1", supplier_code: null, raw_description: "Cable", cost: 100, currency: "USD", tax_treatment: "EXCLUDED" }, quantity: 2 },
  { supplierId: "s1", versionId: "v2", listName: "Lista 2", line: { id: "l2", supplier_code: null, raw_description: "Tuerca", cost: 50, currency: "USD", tax_treatment: "EXCLUDED" }, quantity: 1 },
  { supplierId: "s2", versionId: "v3", listName: "Otra lista", line: { id: "l3", supplier_code: null, raw_description: "Tornillo", cost: 20, currency: "USD", tax_treatment: "EXCLUDED" }, quantity: 1 },
];
function setup(rate?: number, currency: "USD" | "ARS" = "USD") {
  const onCreated = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter><QueryClientProvider client={client}><SupplierCart companyId="c1" items={items} currency={currency} rate={rate} onUpdate={vi.fn()} onRemove={vi.fn()} onCreated={onCreated} /></QueryClientProvider></MemoryRouter>);
  return { onCreated };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSupplier).mockImplementation(async (_company, id) => ({ id, name: `Proveedor ${id}`, is_active: true, vat_rate: 21, freight_rate: 5 } as Supplier));
});
describe("supplier grouped cart", () => {
  it("creates one order with products from multiple lists, keeping the other supplier", async () => {
    vi.mocked(createSupplierPurchaseOrder).mockResolvedValue({ company_id: "c1", supplier_id: "s1" } as SupplierPurchaseOrder);
    const { onCreated } = setup();
    await screen.findByText("Proveedor s1");
    const group = screen.getByText("Proveedor s1").closest("section")!;
    expect(within(group).getByText("USD 315,00")).toBeInTheDocument();
    fireEvent.change(within(group).getByLabelText("Observaciones para Proveedor s1"), { target: { value: "Entregar viernes" } });
    fireEvent.click(within(group).getByRole("button", { name: "Generar orden de compra" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar orden" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("s1"));
    expect(createSupplierPurchaseOrder).toHaveBeenCalledWith({ companyId: "c1", supplierId: "s1", catalogVersionId: "v1", lines: [{ catalogLineId: "l1", quantity: 2 }, { catalogLineId: "l2", quantity: 1 }], notes: "Entregar viernes" });
    expect(screen.getByText("Proveedor s2")).toBeInTheDocument();
  });
  it("keeps the cart and observations when the server rejects the order", async () => {
    vi.mocked(createSupplierPurchaseOrder).mockRejectedValue(new Error("Sin permiso en esta empresa"));
    const { onCreated } = setup();
    await screen.findByText("Proveedor s1");
    const group = screen.getByText("Proveedor s1").closest("section")!;
    fireEvent.change(within(group).getByLabelText("Observaciones para Proveedor s1"), { target: { value: "Conservar" } });
    fireEvent.click(within(group).getByRole("button", { name: "Generar orden de compra" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar orden" }));
    await screen.findAllByText("Sin permiso en esta empresa");
    expect(onCreated).not.toHaveBeenCalled();
    expect(within(group).getByLabelText("Observaciones para Proveedor s1")).toHaveValue("Conservar");
    expect(within(group).getByText("Cable")).toBeInTheDocument();
  });
  it("blocks conversion-dependent orders when BNA is unavailable", async () => {
    setup(undefined, "ARS");
    await screen.findByText("Proveedor s1");
    for (const button of screen.getAllByRole("button", { name: "Generar orden de compra" })) expect(button).toBeDisabled();
    expect(createSupplierPurchaseOrder).not.toHaveBeenCalled();
    expect(fetchSupplier).toHaveBeenCalledWith("c1", "s1");
    expect(fetchSupplier).toHaveBeenCalledWith("c1", "s2");
  });
});
