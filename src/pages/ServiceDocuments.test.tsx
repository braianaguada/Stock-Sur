import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const supabaseInvokeMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/common/CompanyAccessNotice", () => ({ CompanyAccessNotice: ({ description }: { description: string }) => <div>{description}</div> }));
vi.mock("@/components/ui/page", () => ({
  FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => <div>{title}{actions}</div>,
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
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: supabaseInvokeMock,
    },
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://example.test/signed.jpg" }, error: null })),
        remove: vi.fn(async () => ({ error: null })),
        upload: vi.fn(async () => ({ error: null })),
      }),
    },
  },
}));
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
    from: (table: string) => ({
      select: () => {
        const rows = table === "service_document_lines"
          ? [{ id: "line-1", description: "Trabajo", quantity: 1, unit: "u", unit_price: 1500, line_total: 1500, sort_order: 1 }]
          : [];
        const chain = {
          eq: () => chain,
          order: async () => ({ data: rows, error: null }),
        };
        return chain;
      },
    }),
  },
}));

import ServiceDocumentsPage from "./ServiceDocuments";

describe("ServiceDocumentsPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    supabaseInvokeMock.mockReset();
  });

  it("shows preview and print actions and opens preview dialog", async () => {
    const write = vi.fn();
    const focus = vi.fn();
    vi.stubGlobal("open", vi.fn(() => ({ document: { open: vi.fn(), write, close: vi.fn() }, focus, close: vi.fn() })));

    render(<ServiceDocumentsPage />);

    expect(screen.getByText("Documentos")).toBeInTheDocument();
    expect(screen.getByTitle("Vista previa")).toBeInTheDocument();
    expect(screen.getByTitle("Guardar PDF")).toBeInTheDocument();
    expect(screen.getByTitle("Imprimir")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Vista previa"));
    expect(screen.getByText("Vista previa del presupuesto de servicio")).toBeInTheDocument();
    expect(screen.getAllByText("Cliente Demo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Abrir impresión"));
    await waitFor(() => expect(window.open).toHaveBeenCalled());

    write.mockClear();
    fireEvent.click(screen.getByTitle("Guardar PDF"));
    await waitFor(() => expect(write).toHaveBeenCalledWith(expect.stringContaining("window.print()")));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Presupuesto de servicio"));
  });

  it("opens the AI assistant and renders a generated price preview", async () => {
    supabaseInvokeMock.mockResolvedValueOnce({
      data: {
        suggestionId: "suggestion-1",
        suggestion: {
          summary: "Limpieza de aire acondicionado split",
          recommendedPricingMode: "GLOBAL_TOTAL",
          recommendedCurrency: "ARS",
          suggestedLines: [
            {
              description: "Limpieza y prueba del equipo",
              quantity: 1,
              unit: "servicio",
              includeInQuote: true,
              notes: "Incluye revision general",
            },
          ],
          possibleMaterials: [],
          laborEstimate: {
            hoursMin: 1,
            hoursRecommended: 2,
            hoursMax: 3,
            notes: "Depende del acceso al equipo",
          },
          priceSuggestion: {
            currency: "ARS",
            min: 50000,
            recommended: 65000,
            max: 80000,
            confidence: "MEDIUM",
            explanation: "Estimacion orientativa para limpieza y prueba.",
          },
          commercialNotes: "Sujeto a revision del equipo.",
          internalNotes: "",
          warnings: ["Confirmar accesibilidad."],
          missingInfoQuestions: ["Cual es la altura de instalacion?"],
          pricingSources: {
            internalHistoryUsed: true,
            internalHistoryCount: 1,
            companySettingsUsed: false,
            externalReferencesUsed: false,
            externalReferenceSummary: "No se pudieron usar referencias externas en esta propuesta.",
            limitations: ["No se pudieron usar referencias externas en esta propuesta."],
          },
          confidenceReasons: ["Hay pocos presupuestos internos similares."],
        },
      },
      error: null,
    });

    render(<ServiceDocumentsPage />);

    fireEvent.click(screen.getByRole("button", { name: /crear con ia/i }));
    expect(screen.getByText("Asistente IA para presupuestar servicios")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Cambio de motocompresor/i), {
      target: { value: "Limpieza de aire acondicionado split, revision y prueba." },
    });
    fireEvent.click(screen.getByRole("button", { name: /generar propuesta/i }));

    await waitFor(() => expect(supabaseInvokeMock).toHaveBeenCalledWith(
      "service-quote-ai-assistant",
      expect.objectContaining({
        body: expect.objectContaining({
          companyId: "company-1",
          description: "Limpieza de aire acondicionado split, revision y prueba.",
        }),
      }),
    ));
    expect(await screen.findByText("Rango sugerido")).toBeInTheDocument();
    expect(screen.getByText("Base de estimacion")).toBeInTheDocument();
    expect(screen.getByText("Referencias externas: no disponibles")).toBeInTheDocument();
    expect(screen.getByText("Recomendado")).toBeInTheDocument();
    expect(screen.getByText("Limpieza y prueba del equipo (1 servicio)")).toBeInTheDocument();
  });
});
