import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DocumentsEditorDialog } from "./DocumentsEditorDialog";

vi.mock("@/components/common/EntityDialog", () => ({
  EntityDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/label", () => ({ Label: ({ children }: { children: ReactNode }) => <label>{children}</label> }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
vi.mock("@/features/documents/utils", () => ({ calculatePriceFromCostBase: () => 0 }));
vi.mock("@/lib/item-display", () => ({ buildItemDisplayMeta: () => "", buildItemDisplayName: () => "" }));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

describe("DocumentsEditorDialog", () => {
  it("keeps the internal customer kind available for remitos", () => {
    render(
      <DocumentsEditorDialog
        open
        onOpenChange={vi.fn()}
        editingDocId={null}
        documentForm={{
          doc_type: "REMITO",
          point_of_sale: 1,
          customer_id: "",
          customer_name: "",
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
        }}
        setDraftForm={vi.fn()}
        lines={[]}
        setLines={vi.fn()}
        totalDraft={0}
        customers={[]}
        technicians={[]}
        priceLists={[]}
        availableItems={[]}
        onPriceListChange={vi.fn()}
        onAddItem={vi.fn()}
        removeLine={vi.fn()}
        onSubmit={vi.fn()}
        onResetDraftForm={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getByText("Personal / técnico interno")).toBeInTheDocument();
  });
});
