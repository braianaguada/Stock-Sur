import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CashDailyExport } from "./CashDailyExport";
import { loadDailyReport } from "../daily-report";

const { toast, writeText } = vi.hoisted(() => ({ toast: vi.fn(), writeText: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("../daily-report", async (original) => ({ ...await original<typeof import("../daily-report")>(), loadDailyReport: vi.fn() }));

describe("CashDailyExport", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined });
  });

  it("copies cells without headers for the selected company and day", async () => {
    vi.mocked(loadDailyReport).mockResolvedValue([["REMITO", "X", 7, 1550, 36000, "EFECT REM"]]);
    render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para Excel" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("REMITO\tX\t7\t1550\t36000,00\tEFECT REM"));
    expect(loadDailyReport).toHaveBeenCalledWith("company-1", "2026-10-16");
  });

  it("copies HTML borders alongside plain cells when rich clipboard is available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", class {
      constructor(public data: Record<string, Blob>) {}
    });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write, writeText } });
    vi.mocked(loadDailyReport).mockResolvedValue([["FACTURA", "A", 9, 2044, 270000, "CTA CTE"]]);
    render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para Excel" }));
    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    const item = write.mock.calls[0][0][0];
    expect(item.data["text/html"].type).toBe("text/html");
    expect(item.data["text/plain"].type).toBe("text/plain");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("discards a pending report after the company or date changes", async () => {
    let resolve!: (rows: Awaited<ReturnType<typeof loadDailyReport>>) => void;
    vi.mocked(loadDailyReport).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para Excel" }));
    view.rerender(<CashDailyExport companyId="company-2" date="2026-10-17" />);
    resolve([["REMITO", "X", 7, 1550, 36000, "EFECT REM"]]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copiar para Excel" })).toBeEnabled());
    expect(writeText).not.toHaveBeenCalled();
  });

  it("discards a report after unmounting on a company switch", async () => {
    let resolve!: (rows: Awaited<ReturnType<typeof loadDailyReport>>) => void;
    vi.mocked(loadDailyReport).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para Excel" }));
    view.unmount();
    resolve([["REMITO", "X", 7, 1550, 36000, "EFECT REM"]]);
    await new Promise((done) => setTimeout(done, 0));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("saves the Excel in the location selected by the user", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const picker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue({ write, close, abort: vi.fn() }) });
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: picker });
    vi.mocked(loadDailyReport).mockResolvedValue([["REMITO", "X", 7, 1550, 36000, "EFECT REM"]]);
    render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Excel del día" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: "Caja-2026-10-16.xlsx" }));
    expect(write.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(write.mock.calls[0][0].size).toBeGreaterThan(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Excel guardado" }));
  });

  it("does not fetch or show an error when the save dialog is cancelled", async () => {
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")) });
    render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Excel del día" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Excel del día" })).toBeEnabled());
    expect(loadDailyReport).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows a query error without copying incomplete data", async () => {
    vi.mocked(loadDailyReport).mockRejectedValue(new Error("No hay conexión"));
    render(<CashDailyExport companyId="company-1" date="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar para Excel" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "No se pudo exportar Caja", description: "No hay conexión", variant: "destructive" })));
    expect(writeText).not.toHaveBeenCalled();
  });
});
