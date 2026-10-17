import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import type { DocRow } from "../types";
import { DocumentsPreviewDialog } from "./DocumentsPreviewDialog";

function renderPreview(docType: DocRow["doc_type"], canPrint = true) {
  const document: DocRow = {
    id: "preview-document", doc_type: docType, status: "BORRADOR", point_of_sale: 9,
    document_number: null, issue_date: "2026-10-17", customer_id: null,
    customer_name: "Cliente final", customer_tax_id: null, customer_tax_condition: null,
    customer_kind: "GENERAL", internal_remito_type: null, payment_terms: null,
    delivery_address: null, salesperson: null, valid_until: null, price_list_id: null,
    source_document_id: null, source_document_type: null, source_document_number_snapshot: null,
    external_invoice_number: null, external_invoice_date: null, external_invoice_status: null,
    notes: null, subtotal: 100, tax_total: 21, total: 121, created_at: "2026-10-17T12:00:00Z",
  };
  const props: ComponentProps<typeof DocumentsPreviewDialog> = {
    open: true, onOpenChange: vi.fn(), selectedDocument: document,
    selectedLines: [], selectedEvents: [], eventUserNamesById: new Map(),
    sourceDocumentLabel: null, technicianName: null, companySettings: DEFAULT_COMPANY_SETTINGS,
    canPrintDocument: canPrint, onOpenPrint: vi.fn(), onDownloadPdf: vi.fn(),
    onDuplicateDocument: vi.fn(), isDuplicatingDocument: false, canDuplicateDocument: true,
    canRegisterInCash: false, isRegisteredInCash: false, onRegisterInCash: vi.fn(),
  };
  render(<DocumentsPreviewDialog {...props} />);
  return props;
}

describe("DocumentsPreviewDialog compact layout", () => {
  it.each(["REMITO", "PRESUPUESTO"] as const)("reserves the available body height for %s without inherited desktop padding or gaps", (docType) => {
    const props = renderPreview(docType);
    const dialog = screen.getByRole("dialog", { name: "Vista previa del documento" });
    // p-0 alone does not override the dialog base's responsive sm:p-6.
    expect(dialog).toHaveClass("p-0", "sm:p-0", "gap-0", "overflow-hidden");
    expect(screen.queryByText("Revision comercial, productos y trazabilidad.")).not.toBeInTheDocument();
    expect(dialog.querySelector(".flex-1")).toHaveClass("min-h-0", "overflow-hidden");

    const print = screen.getByRole("button", { name: "Abrir impresion" });
    const download = screen.getByRole("button", { name: "Descargar PDF" });
    const duplicate = screen.getByRole("button", { name: "Duplicar" });
    for (const action of [print, download, duplicate]) expect(action).toHaveClass("h-9");
    fireEvent.click(print);
    fireEvent.click(download);
    fireEvent.click(duplicate);
    expect(props.onOpenPrint).toHaveBeenCalledWith(props.selectedDocument);
    expect(props.onDownloadPdf).toHaveBeenCalledWith(props.selectedDocument);
    expect(props.onDuplicateDocument).toHaveBeenCalledWith(props.selectedDocument);
  });

  it("keeps document and history switching available in the compact mobile bar", () => {
    renderPreview("REMITO");
    const tabs = within(screen.getByRole("tablist"));
    fireEvent.click(tabs.getByRole("tab", { name: "Historial (0)" }));
    expect(tabs.getByRole("tab", { name: "Historial (0)" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs.getByRole("tab", { name: "Documento" }));
    expect(tabs.getByRole("tab", { name: "Documento" })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves print and download permission checks", () => {
    renderPreview("PRESUPUESTO", false);
    expect(screen.getByRole("button", { name: "Abrir impresion" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeDisabled();
  });
});
