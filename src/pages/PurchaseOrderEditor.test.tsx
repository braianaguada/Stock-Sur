import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseOrderEditor from "./PurchaseOrderEditor";

const mocks = vi.hoisted(() => ({
  auth: { currentCompany: { id: "company-1" }, roles: ["superadmin"], companyPermissionCodes: [] as string[] },
  save: vi.fn(), navigate: vi.fn(), toast: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate, useParams: () => ({}) }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/features/purchase-orders/api", () => ({ saveManualPurchaseOrder: mocks.save }));
vi.mock("@/features/purchase-orders/PurchaseOrderCollectorSelect", () => ({
  PurchaseOrderCollectorSelect: ({ value, onChange }: { value: string; onChange: (name: string) => void }) => <select aria-label="Retira" value={value} onChange={event => onChange(event.target.value)}><option value="">Sin técnico</option><option value="Carlos">Carlos</option></select>,
}));
vi.mock("@/features/purchase-orders/hooks", () => ({
  useSupplierPurchaseOrders: () => ({}), useSupplierPurchaseOrderLines: () => ({}),
  purchaseOrderKeys: { lines: (companyId: string, id: string) => ["supplier-purchase-order-lines", companyId, id] },
}));
vi.mock("@/features/items/components/ItemSupplierSelect", () => ({
  ItemSupplierSelect: ({ value, onChange }: { value: string; onChange: (id: string, name: string, address: string) => void }) => <select aria-label="Proveedor registrado" value={value} onChange={event => onChange(event.target.value, "Proveedor Uno", event.target.value ? "San Martin 123" : "")}><option value="">Seleccionar</option><option value="supplier-1">Proveedor Uno</option></select>,
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={queryClient}><PurchaseOrderEditor /></QueryClientProvider>);
  return { ...view, queryClient };
}

describe("manual purchase order editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.currentCompany = { id: "company-1" };
    mocks.auth.roles = ["superadmin"];
    mocks.auth.companyPermissionCodes = [];
    mocks.save.mockResolvedValue({ id: "order-1", order_number: 42 });
  });

  it("saves the selected registered supplier and entered lines before opening the order", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Proveedor registrado"), { target: { value: "supplier-1" } });
    expect(screen.getByLabelText("Domicilio del proveedor")).toHaveValue("San Martin 123");
    fireEvent.change(screen.getByLabelText("Retira"), { target: { value: "Carlos" } });
    fireEvent.change(screen.getByLabelText("Descripción 1"), { target: { value: "Caño de cobre 3/8" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Costo unitario"), { target: { value: "125.50" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar borrador" })[0]);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ form: expect.objectContaining({ collected_by: "Carlos" }) }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1", supplierId: "supplier-1", orderId: null, requestId: expect.any(String), lines: [expect.objectContaining({ description: "Caño de cobre 3/8", quantity: 2, unit_cost: 125.5, currency: "ARS" })] }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/purchase-orders?order=order-1"));
  });

  it("keeps each product independently editable and removable in the compact layout", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Descripción 1"), { target: { value: "Primer producto" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    const second = screen.getByRole("group", { name: "Producto 2" });
    fireEvent.change(within(second).getByLabelText("Descripción 2"), { target: { value: "Segundo producto" } });
    fireEvent.change(within(second).getByLabelText("Cantidad"), { target: { value: "3" } });
    fireEvent.change(within(second).getByLabelText("Moneda"), { target: { value: "USD" } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar producto 1" }));
    const remaining = screen.getByRole("group", { name: "Producto 1" });
    expect(within(remaining).getByLabelText("Descripción 1")).toHaveValue("Segundo producto");
    expect(within(remaining).getByLabelText("Cantidad")).toHaveValue(3);
    expect(within(remaining).getByLabelText("Moneda")).toHaveValue("USD");
    expect(screen.queryByRole("group", { name: "Producto 2" })).toBeNull();
  });

  it("clears supplier and draft values when switching company", () => {
    const view = setup();
    fireEvent.change(screen.getByLabelText("Proveedor registrado"), { target: { value: "supplier-1" } });
    fireEvent.change(screen.getByLabelText("Descripción 1"), { target: { value: "Producto de empresa Uno" } });
    mocks.auth.currentCompany = { id: "company-2" };
    view.rerender(<QueryClientProvider client={view.queryClient}><PurchaseOrderEditor /></QueryClientProvider>);
    expect(screen.getByLabelText("Proveedor registrado")).toHaveValue("");
    expect(screen.getByLabelText("Descripción 1")).toHaveValue("");
    expect(screen.getAllByRole("button", { name: "Guardar borrador" })[0]).toBeDisabled();
  });

  it("prevents saving without the effective edit permission", () => {
    mocks.auth.roles = ["user"];
    setup();
    expect(screen.getByRole("alert")).toHaveTextContent("Necesitás permiso");
    expect(screen.getAllByRole("button", { name: "Guardar borrador" })[0]).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
