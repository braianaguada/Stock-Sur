import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSupplier } from "../queries";
import { fetchSupplierComparisonVersions } from "../comparison/queries";
import type { SupplierCartItem } from "../pricing";
import { SupplierPurchasingActions, SupplierPurchasingProvider } from "./SupplierPurchasingProvider";
import { useSupplierPurchasing } from "../hooks/useSupplierPurchasing";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../hooks/useSupplierExchangeRate", () => ({ useSupplierExchangeRate: () => ({ data: { rate: 1000, rateDate: "2026-10-23" }, refetch: vi.fn() }) }));
vi.mock("../queries", () => ({ fetchSupplier: vi.fn() }));
vi.mock("../comparison/queries", () => ({ fetchSupplierComparisonVersions: vi.fn() }));
vi.mock("./SupplierCart", () => ({ SupplierCart: ({ items, notesBySupplier, onNotesChange, onUpdate, onCreated }: {
  items: SupplierCartItem[]; notesBySupplier: Record<string, string>; onNotesChange: (id: string, value: string) => void;
  onUpdate: (id: string, quantity: number) => void; onCreated: (id: string) => void;
}) => <div>
  <input aria-label="Notas" value={notesBySupplier.s1 ?? ""} onChange={(event) => onNotesChange("s1", event.target.value)} />
  <button onClick={() => onUpdate(items[0].line.id, 3)}>Cambiar cantidad</button>
  <button onClick={() => onCreated("s1")}>Crear orden proveedor 1</button>
  <p>{items.length} líneas en carrito</p>
</div> }));

const item = (supplierId: string): SupplierCartItem => ({
  supplierId, versionId: `v-${supplierId}`, listName: "Lista", quantity: 2,
  line: { id: `line-${supplierId}`, raw_description: "Producto", cost: 10, currency: "USD", tax_treatment: "EXCLUDED" } as SupplierCartItem["line"],
});

function Harness() {
  const cart = useSupplierPurchasing();
  const location = useLocation();
  return <>
    <SupplierPurchasingActions />
    <p>{location.pathname}{location.search}</p>
    <Link to="/customers">Ir a clientes</Link>
    <button onClick={() => cart?.addItem(item("s1"))}>Agregar uno</button>
    <button onClick={() => cart?.addItem(item("s2"))}>Agregar dos</button>
    <button onClick={() => cart?.open()}>Abrir pedido</button>
  </>;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><SupplierPurchasingProvider><Harness /></SupplierPurchasingProvider></MemoryRouter></QueryClientProvider>;
  const result = render(tree());
  return { rerender: () => result.rerender(tree()) };
}

function auth(companyId = "company-1", userId = "user-1") {
  vi.mocked(useAuth).mockReturnValue({ user: { id: userId }, actorUser: { id: userId }, currentCompany: { id: companyId, status: "ACTIVE" }, loading: false, switchingCompany: false } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth();
  vi.mocked(fetchSupplier).mockImplementation(async (_company, id) => ({ id, vat_rate: 21, freight_rate: 5 } as Awaited<ReturnType<typeof fetchSupplier>>));
  vi.mocked(fetchSupplierComparisonVersions).mockResolvedValue([{ id: "v1", supplierId: "s1", supplierName: "Proveedor uno", listName: "Lista uno", importedAt: "2026-10-23" }]);
});

describe("global supplier purchasing", () => {
  it("keeps products and notes outside suppliers, updates totals, and removes only the ordered supplier", async () => {
    setup();
    fireEvent.click(screen.getByText("Agregar uno"));
    fireEvent.click(screen.getByText("Agregar dos"));
    fireEvent.click(screen.getByText("Abrir pedido"));
    await screen.findByLabelText("Notas");
    await screen.findByText("Total con IVA y flete: ARS 50.400,00");
    fireEvent.change(screen.getByLabelText("Notas"), { target: { value: "Entrega lunes" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByText("Ir a clientes"));
    expect(screen.getByText("/customers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carrito de compras: 2 productos" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Abrir pedido"));
    expect(screen.getByLabelText("Notas")).toHaveValue("Entrega lunes");
    fireEvent.click(screen.getByText("Cambiar cantidad"));
    await screen.findByText("Total con IVA y flete: ARS 63.000,00");
    fireEvent.click(screen.getByText("Crear orden proveedor 1"));
    await screen.findByText("Total con IVA y flete: ARS 25.200,00");
    expect(screen.getByText("1 líneas en carrito")).toBeInTheDocument();
  });

  it.each(["company", "user", "logout", "inactive"])("clears the cart on %s changes without restoring old products", async (change) => {
    const result = setup();
    fireEvent.click(screen.getByText("Agregar uno"));
    expect(screen.getByRole("button", { name: "Carrito de compras: 1 productos" })).toBeInTheDocument();
    if (change === "company") auth("company-2");
    if (change === "user") auth("company-1", "user-2");
    if (change === "logout") vi.mocked(useAuth).mockReturnValue({ user: null, currentCompany: null } as ReturnType<typeof useAuth>);
    if (change === "inactive") vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, currentCompany: { id: "company-1", status: "INACTIVE" } } as ReturnType<typeof useAuth>);
    result.rerender();
    expect(screen.queryByRole("button", { name: "Carrito de compras: 1 productos" })).not.toBeInTheDocument();
    auth();
    result.rerender();
    expect(screen.getByRole("button", { name: "Carrito de compras: 0 productos" })).toBeInTheDocument();
    await waitFor(() => expect(fetchSupplier).toHaveBeenCalledWith("company-1", "s1"));
  });

  it("starts an empty order by selecting a supplier followed by its list", async () => {
    setup();
    fireEvent.click(screen.getByText("Abrir pedido"));
    expect(screen.getByRole("combobox", { name: "Lista del pedido" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Proveedor del pedido" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Proveedor uno" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Lista del pedido" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Lista uno" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver productos" }));
    await screen.findByText("/suppliers?supplier=s1&list=v1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
