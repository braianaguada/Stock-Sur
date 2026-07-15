import { fireEvent, render, screen } from "@testing-library/react";
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
  it("keeps one visible row action and groups secondary actions", () => {
    renderTable([baseDocument]);

    expect(screen.getByRole("button", { name: "Ver detalle" })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Registrar en Caja" }));

    expect(props.onRegisterInCash).toHaveBeenCalledWith(emittedRemito);
  });

  it("shows the registered state and prevents another registration", () => {
    renderTable([emittedRemito], { cashRegisteredDocumentIds: new Set([emittedRemito.id]) });

    expect(screen.getByText("Registrado en Caja")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar en Caja" })).not.toBeInTheDocument();
  });

  it("hides the action without cash.create permission", () => {
    renderTable([emittedRemito], { canRegisterInCash: false });

    expect(screen.queryByRole("button", { name: "Registrar en Caja" })).not.toBeInTheDocument();
  });
});
