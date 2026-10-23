import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Supplier, SupplierCatalog } from "../types";
import { SupplierExcelImport } from "./SupplierExcelImport";

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), invalidate: vi.fn() }));
vi.mock("../excelImport", async (original) => ({ ...await original<typeof import("../excelImport")>(), readSupplierExcel: mocks.read }));
vi.mock("../excelImportGateway", () => ({ saveSupplierExcel: mocks.save }));
vi.mock("@/lib/invalidate", () => ({ invalidateSupplierCatalogQueries: mocks.invalidate }));

function setup(catalogs: SupplierCatalog[] = [], catalogsError?: Error, onRetryCatalogs = vi.fn()) {
  const onImported = vi.fn();
  const onCancel = vi.fn();
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><SupplierExcelImport companyId="c1" supplier={{ id: "s1", name: "Proveedor", is_active: true } as Supplier} catalogs={catalogs} catalogsError={catalogsError} onRetryCatalogs={onRetryCatalogs} onCancel={onCancel} onImported={onImported} /></QueryClientProvider>);
  return { ...view, onImported, onCancel };
}

async function choose(label: string, option: string) {
  await act(async () => { fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown" }); });
  const item = await screen.findByRole("option", { name: option });
  await act(async () => { fireEvent.click(item); });
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
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    await waitFor(() => expect(view.onImported).toHaveBeenCalledWith("v1"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ companyId: "c1", supplierId: "s1", catalogId: null, title: "octubre", currency: "USD", rows: [expect.objectContaining({ name: "Tornillo", unit: "unidad", price: 12.5, row: 2 })] }));
  });

  it("keeps the upload draft and offers retry when existing lists cannot be loaded", async () => {
    const retry = vi.fn();
    setup([], new Error("Sin acceso a listas"), retry);
    await prepare();
    expect(screen.getByRole("alert")).toHaveTextContent("Sin acceso a listas");
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("shows server errors without closing the draft or reporting success", async () => {
    mocks.save.mockRejectedValue({ message: "Sin permiso de edición" });
    const view = setup();
    await prepare();
    fireEvent.click(screen.getByRole("checkbox", { name: "Importar fila 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin permiso de edición");
    expect(view.onImported).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Importar" })).toBeEnabled();
  });

  it("replaces only the selected list and preserves its name when uploading a differently named file", async () => {
    const view = setup([{ id: "list-1", title: "Lista habitual", created_at: "2026-10-23" }]);
    fireEvent.click(screen.getByRole("radio", { name: "Reemplazar existente" }));
    await choose("Lista que querés reemplazar", "Lista habitual");
    await prepare();
    expect(screen.queryByLabelText("Nombre de la lista")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    await waitFor(() => expect(view.onImported).toHaveBeenCalledWith("v1"));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ catalogId: "list-1", title: "Lista habitual", fileName: "octubre.xlsx" }));
  });

  it("requires an existing list selection before replacing and disables replacement for a new supplier", async () => {
    const view = setup();
    expect(screen.getByRole("radio", { name: "Reemplazar existente" })).toBeDisabled();
    view.unmount();
    setup([{ id: "list-1", title: "Lista habitual", created_at: "2026-10-23" }]);
    fireEvent.click(screen.getByRole("radio", { name: "Reemplazar existente" }));
    await prepare();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("asks before discarding a loaded file from Escape and keeps the draft if canceled", async () => {
    const view = setup();
    await prepare();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("¿Descartar esta carga?");
    expect(view.onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir revisando" }));
    expect(screen.getByText("Archivo en revisión: octubre.xlsx")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar y volver" }));
    expect(view.onCancel).toHaveBeenCalledOnce();
  });

  it("prevents closing while saving through Escape, outside interaction or the close button", async () => {
    let finish: (value: string) => void = () => undefined;
    mocks.save.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    const view = setup();
    await prepare();
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.pointerDown(document.body);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(view.onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await act(async () => { finish("v1"); });
    await waitFor(() => expect(view.onImported).toHaveBeenCalledWith("v1"));
  });
});
