import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { DocumentFormState } from "@/features/documents/types";
import { DocumentsEditorDialog } from "./DocumentsEditorDialog";

vi.mock("@/components/common/EntityDialog", () => ({
  EntityDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/label", () => ({ Label: ({ children }: { children: ReactNode }) => <label>{children}</label> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
vi.mock("@/features/documents/utils", () => ({
  calculatePriceFromCostBase: () => 0,
  changeDocumentRecipientType: (form: DocumentFormState) => form,
  changeRemitoUsage: (form: DocumentFormState) => form,
}));
vi.mock("@/lib/item-display", () => ({ buildItemDisplayMeta: () => "", buildItemDisplayName: () => "" }));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

const baseForm: DocumentFormState = {
  recipient_type: "OCCASIONAL",
  doc_type: "REMITO",
  point_of_sale: 1,
  customer_id: "",
  customer_name: "Cliente ocasional",
  customer_tax_condition: "",
  customer_tax_id: "",
  customer_kind: "GENERAL",
  internal_remito_type: "",
  payment_terms: "",
  delivery_address: "",
  salesperson: "",
  valid_until: "",
  price_list_id: "",
  notes: "",
};

function renderDialog(documentForm: DocumentFormState, onSubmit = vi.fn()) {
  render(
    <DocumentsEditorDialog
      open
      onOpenChange={vi.fn()}
      editingDocId={null}
      documentForm={documentForm}
      setDraftForm={vi.fn()}
      lines={[]}
      setLines={vi.fn()}
      totalDraft={0}
      customers={[{ id: "customer-1", name: "Cliente registrado" }]}
      technicians={[{ id: "technician-1", name: "Tecnico Uno" }]}
      serviceOptions={[
        {
          id: "service-1",
          title: "Instalacion",
          status: "PENDING",
          jobId: "job-1",
          jobTitle: "Trabajo",
          customerId: "customer-1",
          customerName: "Cliente registrado",
        },
      ]}
      priceLists={[]}
      availableItems={[]}
      combos={[]}
      onPriceListChange={vi.fn()}
      onAddItem={vi.fn()}
      onAddCombo={vi.fn()}
      removeLine={vi.fn()}
      onSubmit={onSubmit}
      onResetDraftForm={vi.fn()}
      isSubmitting={false}
    />,
  );

  return { onSubmit };
}

describe("DocumentsEditorDialog", () => {
  it("keeps the internal customer kind available for remitos", () => {
    renderDialog({ ...baseForm, customer_kind: "INTERNO", customer_name: "" });

    expect(screen.getByText("Uso del remito *")).toBeInTheDocument();
    expect(screen.getByText("Tecnico responsable *")).toBeInTheDocument();
    expect(screen.getByText("Tipo / motivo interno *")).toBeInTheDocument();
    expect(screen.queryByText("Destinatario")).not.toBeInTheDocument();
    expect(screen.queryByText("Servicio asociado")).not.toBeInTheDocument();
  });

  it("shows occasional identification without fiscal, technician, or service fields", () => {
    renderDialog(baseForm);

    expect(screen.getByText("Destinatario")).toBeInTheDocument();
    expect(screen.getByText("Uso del remito *")).toBeInTheDocument();
    expect(screen.getByText("Cliente ocasional / Consumidor Final")).toBeInTheDocument();
    expect(screen.getByText("Cliente registrado")).toBeInTheDocument();
    expect(screen.getByText("Nombre ocasional")).toBeInTheDocument();
    expect(screen.queryByText("Nombre cliente")).not.toBeInTheDocument();
    expect(screen.queryByText("CUIT")).not.toBeInTheDocument();
    expect(screen.queryByText("Tecnico asociado")).not.toBeInTheDocument();
    expect(screen.queryByText("Servicio asociado")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente registrado", { selector: "label" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente / Empresa")).not.toBeInTheDocument();
  });

  it("allows service association only for a registered customer", () => {
    renderDialog({ ...baseForm, recipient_type: "REGISTERED", customer_id: "customer-1", customer_name: "Cliente registrado" });

    expect(screen.queryByText("Tipo de cliente registrado")).not.toBeInTheDocument();
    expect(screen.queryByText("Persona / Particular")).not.toBeInTheDocument();
    expect(screen.getByText("Cliente registrado", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("Tecnico asociado")).toBeInTheDocument();
    expect(screen.getByText("Servicio asociado")).toBeInTheDocument();
    expect(screen.queryByText("Nombre ocasional")).not.toBeInTheDocument();
  });

  it("locks customer changes while a service is linked", () => {
    renderDialog({
      ...baseForm,
      recipient_type: "REGISTERED",
      customer_id: "customer-1",
      customer_name: "Cliente registrado",
      service_id: "service-1",
    });

    expect(screen.getByText("Cliente bloqueado por el servicio asociado. Desvincula el servicio para cambiar cliente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desvincular servicio para cambiar cliente" })).toBeInTheDocument();
  });

  it("shows inline errors for internal remitos without technician or internal type", () => {
    const { onSubmit } = renderDialog({
      ...baseForm,
      customer_kind: "INTERNO",
      customer_name: "",
      technician_id: "",
      internal_remito_type: "",
    });

    fireEvent.submit(screen.getByRole("button", { name: "Guardar borrador" }).closest("form")!);

    expect(screen.getByText("Selecciona un tecnico responsable para el remito interno.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona el tipo o motivo interno del remito.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps submit enabled for valid internal remitos", () => {
    const { onSubmit } = renderDialog({
      ...baseForm,
      customer_kind: "INTERNO",
      customer_name: "",
      technician_id: "technician-1",
      internal_remito_type: "DESCUENTO_SUELDO",
    });

    fireEvent.submit(screen.getByRole("button", { name: "Guardar borrador" }).closest("form")!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
