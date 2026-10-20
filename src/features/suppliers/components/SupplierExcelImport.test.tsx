import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Supplier } from "../types";
import { SupplierExcelImport } from "./SupplierExcelImport";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), invalidate: vi.fn() }));
vi.mock("../excelImport", async (original) => ({ ...await original<typeof import("../excelImport")>(), readSupplierExcel: mocks.read }));
vi.mock("../excelImportGateway", () => ({ saveSupplierExcel: mocks.save }));
vi.mock("@/lib/invalidate", () => ({ invalidateSupplierCatalogQueries: mocks.invalidate }));

function setup() {
  const onImported = vi.fn();
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><SupplierExcelImport companyId="c1" supplier={{ id: "s1", name: "Proveedor", is_active: true } as Supplier} catalogs={[]} onCancel={vi.fn()} onImported={onImported} /></QueryClientProvider>);
  return { ...view, onImported };
}

async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

async function prepare() {
  fireEvent.change(screen.getByLabelText(/Archivo Excel/), { target: { files: [new File(["excel"], "octubre.xlsx")] } });
  await screen.findByText("Archivo en revisión: octubre.xlsx");
  await choose("Moneda de todos los precios", "Dólares (USD)");
  await choose("Columna: nombre (obligatoria)", "Col. 1: Nombre");
  await choose("Columna: precio sin IVA (obligatoria)", "Col. 2: Precio");
}

describe("SupplierExcelImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue([{ name: "Lista", rows: [["Nombre", "Precio"], ["Tornillo", 12.5], ["Tuerca", "consultar"]] }]);
    mocks.save.mockResolvedValue("v1");
    mocks.invalidate.mockResolvedValue(undefined);
  });

  it("automatically excludes invalid rows, defaults the unit and preserves the chosen currency", async () => {
    const view = setup();
    await prepare();
    expect(screen.getByRole("checkbox", { name: "Importar fila 3" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Importar fila 3" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Importar fila 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Importar 1 productos sin IVA" }));
    await waitFor(() => expect(view.onImported).toHaveBeenCalledWith("v1"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ companyId: "c1", supplierId: "s1", currency: "USD", rows: [expect.objectContaining({ name: "Tornillo", unit: "unidad", price: 12.5, row: 2 })] }));
  });

  it("shows server errors without closing the draft or reporting success", async () => {
    mocks.save.mockRejectedValue({ message: "Sin permiso de edición" });
    const view = setup();
    await prepare();
    fireEvent.click(screen.getByRole("checkbox", { name: "Importar fila 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Importar 1 productos sin IVA" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin permiso de edición");
    expect(view.onImported).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Importar 1 productos sin IVA" })).toBeEnabled();
  });
});
