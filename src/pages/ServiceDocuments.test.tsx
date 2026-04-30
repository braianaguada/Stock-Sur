import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/common/CompanyAccessNotice", () => ({ CompanyAccessNotice: ({ description }: { description: string }) => <div>{description}</div> }));
vi.mock("@/components/ui/page", () => ({
  FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentCompany: { id: "company-1" },
    companyRoleCodes: ["admin"],
    companyPermissionCodes: ["documents.create", "documents.edit", "documents.approve", "documents.cancel", "documents.print"],
  }),
}));
vi.mock("@/contexts/company-brand-context", () => ({
  useCompanyBrand: () => ({ settings: {} }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/features/services/hooks/useServiceDocuments", () => ({
  useServiceDocuments: () => ({
    customers: [{ id: "cust-1", name: "Cliente Demo" }],
    documents: [
      {
        id: "doc-1",
        number: 12,
        issue_date: "2026-04-29",
        status: "DRAFT",
        total: 1500,
        customers: { name: "Cliente Demo" },
      },
    ],
    selectedDocument: {
      id: "doc-1",
      number: 12,
      issue_date: "2026-04-29",
      status: "DRAFT",
      total: 1500,
      subtotal: 1500,
      customers: { name: "Cliente Demo" },
      reference: "Ref 1",
    },
    selectedLines: [{ id: "line-1", description: "Trabajo", quantity: 1, unit: "u", line_total: 1500, sort_order: 1 }],
    selectedEvents: [],
    isLoading: false,
  }),
}));
vi.mock("@/features/services/hooks/useServiceDocumentMutations", () => ({
  calculateServiceLineTotal: () => 1500,
  useServiceDocumentMutations: () => ({
    upsertMutation: { mutate: vi.fn(), isPending: false },
    duplicateMutation: { mutate: vi.fn(), isPending: false },
    convertToRemitoMutation: { mutate: vi.fn(), isPending: false },
    transitionMutation: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/features/services/db", () => ({
  serviceDb: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [{ id: "line-1", description: "Trabajo", quantity: 1, unit: "u", unit_price: 1500, line_total: 1500, sort_order: 1 }],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

import ServiceDocumentsPage from "./ServiceDocuments";

describe("ServiceDocumentsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows preview and print actions and opens preview dialog", async () => {
    const write = vi.fn();
    const focus = vi.fn();
    vi.stubGlobal("open", vi.fn(() => ({ document: { open: vi.fn(), write, close: vi.fn() }, focus })));

    render(<ServiceDocumentsPage />);

    expect(screen.getByText("Documentos")).toBeInTheDocument();
    expect(screen.getByTitle("Vista previa")).toBeInTheDocument();
    expect(screen.getByTitle("Imprimir")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Vista previa"));
    expect(screen.getByText("Vista previa del presupuesto de servicio")).toBeInTheDocument();
    expect(screen.getAllByText("Cliente Demo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Abrir impresión"));
    await waitFor(() => expect(window.open).toHaveBeenCalled());
  });
});
