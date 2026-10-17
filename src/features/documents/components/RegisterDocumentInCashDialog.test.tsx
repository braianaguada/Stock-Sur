import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocRow } from "../types";
import { RegisterDocumentInCashDialog } from "./RegisterDocumentInCashDialog";

afterEach(cleanup);
const document = { id: "doc", document_number: 58, point_of_sale: 9, issue_date: "2026-10-17", total: 720, customer_id: null, customer_name: "Cliente final", external_invoice_status: null, external_invoice_number: null } as DocRow;
describe("RegisterDocumentInCashDialog", () => {
  it("registers a remito without an invoice", () => {
    const onConfirm = vi.fn();
    render(<RegisterDocumentInCashDialog document={document} open isSubmitting={false} isClosedBusinessDate={false} onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(onConfirm).toHaveBeenCalledWith("EFECTIVO_REMITO", "");
  });
  it("passes the optional invoice with the cash registration", () => {
    const onConfirm = vi.fn();
    render(<RegisterDocumentInCashDialog document={document} open isSubmitting={false} isClosedBusinessDate={false} onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText("Factura A (opcional)"), { target: { value: " 0009-00001818 " } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(onConfirm).toHaveBeenCalledWith("EFECTIVO_REMITO", "0009-00001818");
  });
});
