import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSupplierComparisonVersions } from "../comparison/queries";
import { fetchSupplier, fetchSupplierCatalogLines } from "../queries";
import { SupplierListsComparison } from "./SupplierListsComparison";

vi.mock("../comparison/queries", () => ({ fetchSupplierComparisonVersions: vi.fn() }));
vi.mock("../queries", () => ({ fetchSupplier: vi.fn(), fetchSupplierCatalogLines: vi.fn() }));
vi.mock("./SupplierListProducts", () => ({ SupplierListProducts: () => <div>Productos cargados</div> }));

const options = [
  { id: "v1", supplierId: "s1", supplierName: "Proveedor Uno", listName: "Lista A", importedAt: "2026-10-23T12:00:00Z" },
  { id: "v2", supplierId: "s1", supplierName: "Proveedor Uno", listName: "Lista B", importedAt: "2026-10-23T12:00:00Z" },
  { id: "v3", supplierId: "s2", supplierName: "Proveedor Dos", listName: "Lista C", importedAt: "2026-10-23T12:00:00Z" },
];

function setup(initialVersionId = "") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><SupplierListsComparison initialVersionId={initialVersionId} companyId="company-1" currency="ARS" onAdd={vi.fn()} toolbar={<span>Moneda compartida</span>} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchSupplierComparisonVersions).mockResolvedValue(options);
  vi.mocked(fetchSupplier).mockResolvedValue({ id: "s1", name: "Proveedor Uno" } as Awaited<ReturnType<typeof fetchSupplier>>);
  vi.mocked(fetchSupplierCatalogLines).mockResolvedValue([]);
});

describe("SupplierListsComparison", () => {
  it("starts with the list opened by the user and limits the other side to another supplier", async () => {
    setup("v2");
    await screen.findByText("Productos cargados");
    expect(screen.getByRole("combobox", { name: "Lista 1" })).toHaveTextContent("Lista B");
    expect(fetchSupplierCatalogLines).toHaveBeenCalledWith({ companyId: "company-1", versionId: "v2", search: "" });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Lista 2" }), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Proveedor Dos · Lista C" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Proveedor Uno · Lista A" })).not.toBeInTheDocument();
  });

  it("keeps search, currency and both supplier choices in the same workspace", async () => {
    setup();
    await screen.findByRole("combobox", { name: "Lista 1" });
    expect(screen.getByRole("combobox", { name: "Lista 2" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar en ambas listas")).toBeInTheDocument();
    expect(screen.getByText("Moneda compartida")).toBeInTheDocument();
    expect(fetchSupplierComparisonVersions).toHaveBeenCalledWith("company-1");
  });

  it("explains why multiple lists of one supplier are insufficient", async () => {
    vi.mocked(fetchSupplierComparisonVersions).mockResolvedValue(options.slice(0, 2));
    setup();
    await screen.findByText("Falta otro proveedor para comparar");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("excludes every list of the first supplier from the second selector", async () => {
    setup();
    const first = await screen.findByRole("combobox", { name: "Lista 1" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Proveedor Uno · Lista A" }));
    await screen.findByText("Productos cargados");
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Lista 2" }), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Proveedor Dos · Lista C" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Proveedor Uno · Lista A" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Proveedor Uno · Lista B" })).not.toBeInTheDocument();
    expect(fetchSupplier).toHaveBeenCalledWith("company-1", "s1");
    expect(fetchSupplierCatalogLines).toHaveBeenCalledWith({ companyId: "company-1", versionId: "v1", search: "" });
  });

  it("lets the user retry when loading the available lists fails", async () => {
    vi.mocked(fetchSupplierComparisonVersions).mockRejectedValueOnce(new Error("Sin conexión"));
    setup();
    await screen.findByText("No se pudieron cargar las listas");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("combobox", { name: "Lista 1" });
    await waitFor(() => expect(fetchSupplierComparisonVersions).toHaveBeenCalledTimes(2));
  });
});
