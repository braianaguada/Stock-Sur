import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DocumentsDataTable } from "./DocumentsDataTable";
import type { DocRow } from "../types";

const baseDocument: DocRow = {
  id: "doc-1",
  doc_type: "PRESUPUESTO",
  status: "BORRADOR",
  point_of_sale: 1,
  document_number: null,
  issue_date: "2026-05-08",
  customer_id: "customer-1",
  technician_id: "tech-1",
  origin_document_id: null,
  customer_name: "Cliente",
  customer_tax_id: "20-123",
  customer_tax_condition: "RI",
  customer_kind: "GENERAL",
  internal_remito_type: null,
  payment_terms: "Contado",
  delivery_address: "Deposito",
  salesperson: "Vendedor",
  valid_until: null,
  price_list_id: "price-list-1",
  source_document_id: null,
  source_document_type: null,
  source_document_number_snapshot: null,
  external_invoice_number: null,
  external_invoice_date: null,
  external_invoice_status: null,
  notes: null,
  subtotal: 100,
  tax_total: 0,
  total: 100,
  created_at: "2026-05-08T12:00:00.000Z",
};

function renderTable(documents: DocRow[], overrides: Partial<ComponentProps<typeof DocumentsDataTable>> = {}) {
  const props: ComponentProps<typeof DocumentsDataTable> = {
    documents,
    isLoading: false,
    pageSize: 10,
    onOpenDetail: vi.fn(),
    onPrint: vi.fn(),
    onDownloadPdf: vi.fn(),
    onShare: vi.fn(),
    onEditDraft: vi.fn(),
    onTransition: vi.fn(),
    onIssueRemito: vi.fn(),
    onCloneAsRemito: vi.fn(),
    onDuplicateDocument: vi.fn(),
    onGenerateReturn: vi.fn(),
    onRegisterInCash: vi.fn(),
    cashRegisteredDocumentIds: new Set(),
    isIssuingDocument: false,
    canPrintDocument: true,
    canEditDocumentDraft: true,
    canIssueRemito: true,
    canCloneBudgetToRemito: true,
    canDuplicateDocument: true,
    canRegisterInCash: true,
    canTransitionDocumentTo: () => true,
    ...overrides,
  };

  render(<DocumentsDataTable {...props} />);
  return props;
}

describe("DocumentsDataTable duplicate action", () => {
  it("keeps invoice and technician details accessible without extra text rows", () => {
    renderTable([{ ...baseDocument, doc_type: "REMITO", status: "EMITIDO", external_invoice_status: "ACTIVE", external_invoice_number: "9-1818" }], { technicianNamesById: new Map([["tech-1", "Juan"]]) });
    const table = within(screen.getByRole("table"));
    expect(table.getByLabelText("Factura A: 9-1818")).toHaveAttribute("title", "Factura A: 9-1818");
    expect(table.getByLabelText("Tecnico: Juan")).toHaveAttribute("title", "Tecnico: Juan");
    expect(table.queryByText("Factura: 9-1818")).not.toBeInTheDocument();
  });
  it("offers retry on page errors instead of reporting an empty history", () => {
    const onRetry = vi.fn();
    renderTable([], { errorMessage: "Error de conexion", onRetry });
    expect(screen.queryByText("No hay documentos para mostrar")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
    expect(onRetry).toHaveBeenCalledOnce();
  });
  it("shows loading on mobile while the requested page is being fetched", () => {
    renderTable([], { isLoading: true });
    expect(screen.getByText("Cargando documentos")).toBeInTheDocument();
    expect(screen.queryByText("No hay documentos para mostrar")).not.toBeInTheDocument();
  });
  it("keeps frequent actions visible and groups secondary actions", () => {
    const props = renderTable([baseDocument]);
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Imprimir" }));
    expect(props.onPrint).toHaveBeenCalledWith(baseDocument);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: "Ver detalle" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Descargar PDF" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /acciones/i })).toBeInTheDocument();
  });

  it("shows duplicate for PRESUPUESTO and REMITO and calls the handler", () => {
    const props = renderTable([
      { ...baseDocument, id: "budget-1", doc_type: "PRESUPUESTO" },
      { ...baseDocument, id: "remito-1", doc_type: "REMITO" },
    ]);

    const actionButtons = screen.getAllByRole("button", { name: /acciones/i });
    expect(actionButtons).toHaveLength(2);

    fireEvent.click(actionButtons[0]);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(actionButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar" }));

    expect(props.onDuplicateDocument).toHaveBeenNthCalledWith(1, "budget-1");
    expect(props.onDuplicateDocument).toHaveBeenNthCalledWith(2, "remito-1");
  });

  it("does not show duplicate for REMITO_DEVOLUCION", () => {
    renderTable([{ ...baseDocument, id: "return-1", doc_type: "REMITO_DEVOLUCION" }]);

    fireEvent.click(screen.getByRole("button", { name: /acciones/i }));
    expect(screen.queryByRole("button", { name: "Duplicar" })).not.toBeInTheDocument();
  });

  it("disables duplicate while creation is not allowed", () => {
    renderTable([{ ...baseDocument, id: "budget-1", doc_type: "PRESUPUESTO" }], {
      canDuplicateDocument: false,
    });

    fireEvent.click(screen.getByRole("button", { name: /acciones/i }));
    expect(screen.getByRole("button", { name: "Duplicar" })).toBeDisabled();
  });
});

describe("DocumentsDataTable cash registration", () => {
  const emittedRemito: DocRow = {
    ...baseDocument,
    id: "remito-emitted-1",
    doc_type: "REMITO",
    status: "EMITIDO",
    document_number: 15,
  };

  it("offers Registrar en Caja for an emitted remito and calls the handler", () => {
    const props = renderTable([emittedRemito]);

    fireEvent.click(screen.getByRole("button", { name: /acciones/i }));
    fireEvent.click(screen.getByRole("button", { name: "Registrar en Caja" }));

    expect(props.onRegisterInCash).toHaveBeenCalledWith(emittedRemito);
  });

  it("shows the registered state and prevents another registration", () => {
    renderTable([emittedRemito], { cashRegisteredDocumentIds: new Set([emittedRemito.id]) });

    fireEvent.click(screen.getByRole("button", { name: /acciones/i }));
    expect(within(screen.getByRole("dialog")).getByText("Registrado en Caja")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Registrar en Caja" })).not.toBeInTheDocument();
  });

  it.each([true, false])("keeps only the row highlight and accessible cash state in both layouts (create permission: %s)", (canRegisterInCash) => {
    renderTable([emittedRemito], {
      cashRegisteredDocumentIds: new Set([emittedRemito.id]),
      canRegisterInCash,
    });
    const cashStates = screen.getAllByText("Registrado en Caja");
    expect(cashStates).toHaveLength(2);
    cashStates.forEach((state) => expect(state).toHaveClass("sr-only"));
    expect(screen.queryByRole("img", { name: "Registrado en Caja" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Registrado en Caja").closest("tr")).toHaveClass("bg-emerald-500/5");
    expect(cashStates.find((state) => !state.closest("table"))?.parentElement).toHaveClass("bg-emerald-500/5");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar en Caja" })).not.toBeInTheDocument();
  });

  it.each([
    { ...emittedRemito, id: "unregistered" },
    { ...emittedRemito, status: "ANULADO" as const },
    { ...emittedRemito, status: "BORRADOR" as const },
    { ...emittedRemito, doc_type: "PRESUPUESTO" as const },
    { ...emittedRemito, doc_type: "REMITO_DEVOLUCION" as const },
  ])("does not mark ineligible documents: $id / $doc_type / $status", (document) => {
    renderTable([document], { cashRegisteredDocumentIds: new Set([emittedRemito.id]) });
    expect(screen.queryByText("Registrado en Caja")).not.toBeInTheDocument();
  });

  it("hides the action without cash.create permission", () => {
    renderTable([emittedRemito], { canRegisterInCash: false });

    expect(screen.queryByRole("button", { name: "Registrar en Caja" })).not.toBeInTheDocument();
  });
});


describe("budget simplified workflow", () => {
  it("offers approval with a draft remito and removes the separate rejected state action", () => {
    const props = renderTable([{ ...baseDocument, status: "ENVIADO" }]);
    fireEvent.click(screen.getByRole("button", { name: /acciones/i }));
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar y crear remito" }));
    expect(props.onCloneAsRemito).toHaveBeenCalledWith("doc-1");
    expect(props.onTransition).not.toHaveBeenCalled();
  });
});

describe("DocumentsDataTable cancelled and rejected highlights", () => {
  it.each([
    ["PRESUPUESTO", "RECHAZADO"],
    ["PRESUPUESTO", "ANULADO"],
    ["REMITO", "RECHAZADO"],
    ["REMITO", "ANULADO"],
  ] as const)("highlights %s / %s in both layouts, even when registered in cash", (doc_type, status) => {
    renderTable([{ ...baseDocument, doc_type, status }], {
      cashRegisteredDocumentIds: new Set([baseDocument.id]),
    });
    const statusLabel = status === "ANULADO" ? "Anulado" : "Rechazado";
    const labels = screen.getAllByText(statusLabel);
    expect(labels).toHaveLength(2);
    const row = within(screen.getByRole("table")).getByText(statusLabel).closest("tr");
    const card = labels.find(label => !label.closest("table"))?.closest(".bg-destructive\\/5");
    for (const surface of [row, card]) {
      expect(surface).toHaveClass("bg-destructive/5", "hover:bg-destructive/10");
      expect(surface).not.toHaveClass("bg-emerald-500/5");
    }
  });

  it("leaves an active document without a highlight when it is not in cash", () => {
    renderTable([baseDocument]);
    const row = within(screen.getByRole("table")).getByText("Borrador").closest("tr");
    expect(row).not.toHaveClass("bg-destructive/5", "bg-emerald-500/5");
  });
});
