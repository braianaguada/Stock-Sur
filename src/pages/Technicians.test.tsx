import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TechniciansPage from "./Technicians";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    currentCompany: { id: "company-1" },
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockTechnicians = [
  { id: "tech-1", name: "Juan Tecnico", phone: "111", notes: "Turno manana", created_at: "2026-05-01" },
];

vi.mock("@/features/technicians/hooks/useTechniciansPage", () => ({
  useTechniciansPage: () => ({
    technicians: mockTechnicians,
    isLoading: false,
    search: "",
    setSearch: vi.fn(),
    dialogOpen: false,
    setDialogOpen: vi.fn(),
    editing: null,
    form: { name: "", phone: "", notes: "" },
    setForm: vi.fn(),
    saveMutation: { isPending: false, mutate: vi.fn() },
    deleteMutation: { isPending: false, mutate: vi.fn() },
    openCreate: vi.fn(),
    openEdit: vi.fn(),
  }),
}));

vi.mock("@/features/technicians/hooks/useTechnicianMaterialControl", () => ({
  getDefaultMaterialControlState: () => ({
    range: "month",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
    technicianId: "ALL",
    customerId: "ALL",
    serviceId: "ALL",
    type: "ALL",
    search: "",
  }),
  getRangeDates: () => ({
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
  }),
  useTechnicianMaterialControl: () => ({
    technicians: mockTechnicians,
    customers: [{ id: "customer-1", name: "Cliente Norte" }],
    services: [{ id: "service-1", title: "Instalacion", job_id: "job-1", jobTitle: "Trabajo Norte", customerName: "Cliente Norte" }],
    documents: [],
    isLoading: false,
    isError: false,
    report: {
      movements: [
        {
          id: "remito-1",
          date: "2026-05-10",
          technicianId: "tech-1",
          technicianName: "Juan Tecnico",
          documentId: "remito-1",
          documentLabel: "0001-00000012",
          documentType: "REMITO",
          movementType: "Entrega",
          customerId: "customer-1",
          customerName: "Cliente Norte",
          serviceId: "service-1",
          serviceLabel: "Instalacion",
          jobId: "job-1",
          jobLabel: "Trabajo Norte",
          items: 2,
          materialValue: 1500,
          commercialTotal: 1800,
          externalInvoiceNumber: "FAC-99",
          originDocumentId: null,
          documentUrl: "/documents?document_id=remito-1",
          serviceUrl: "/service-jobs?serviceId=service-1",
        },
      ],
      technicianSummaries: [
        {
          technicianId: "tech-1",
          technicianName: "Juan Tecnico",
          remitos: 1,
          devoluciones: 0,
          clients: 1,
          jobs: 1,
          materialDeliveredValue: 1500,
          materialReturnedValue: 0,
          materialBalance: 1500,
          commercialDeliveredTotal: 1800,
          commercialReturnedTotal: 0,
          commercialBalance: 1800,
          movements: [],
        },
      ],
      materialRowsByTechnician: new Map(),
      totals: {
        materialDeliveredValue: 1500,
        materialReturnedValue: 0,
        materialBalance: 1500,
        commercialDeliveredTotal: 1800,
        commercialReturnedTotal: 0,
        commercialBalance: 1800,
        commercialPeriodTotal: 1800,
        remitos: 1,
        devoluciones: 0,
        clients: 1,
        jobs: 1,
      },
    },
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <TechniciansPage />
    </MemoryRouter>,
  );
}

describe("TechniciansPage", () => {
  it("renders the technicians tab with list and create action", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Tecnicos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo tecnico/i })).toBeInTheDocument();
    expect(screen.getByText("Juan Tecnico")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver control/i })).toBeInTheDocument();
  });

  it("renders material control tab with this month as default date range", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Ver control/i }));

    expect(screen.getAllByText("Balance de materiales").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("2026-05-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument();
    expect(screen.getAllByText("Movimientos por tecnico").length).toBeGreaterThan(0);
    expect(screen.getByText("Movimientos detallados")).toBeInTheDocument();
  });

  it("does not use financial account language in the page", async () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Ver control/i }));

    const text = container.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("deuda");
    expect(text).not.toContain("cuenta corriente");
    expect(text).not.toContain("saldo de cuenta");
    expect(text).not.toContain("pendiente de devolucion");
  });
});
