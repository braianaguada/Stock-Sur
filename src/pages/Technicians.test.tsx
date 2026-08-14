import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import TechniciansPage from "./Technicians";

Object.defineProperty(Element.prototype, "hasPointerCapture", {
  configurable: true,
  value: vi.fn(() => false),
});

Object.defineProperty(Element.prototype, "setPointerCapture", {
  configurable: true,
  value: vi.fn(),
});

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

vi.mock("@/features/technicians/components/TechnicianDailyBoard", () => ({
  TechnicianDailyBoard: () => <div>Estado actual de tecnicos</div>,
}));

const mockTechnicians = [
  { id: "tech-1", name: "Juan Tecnico", phone: "111", notes: "Turno manana", is_active: true, created_at: "2026-05-01" },
  { id: "tech-2", name: "Ana Inactiva", phone: "222", notes: "Historico", is_active: false, created_at: "2026-05-01" },
];
const toggleActiveMock = vi.fn();
const materialControlStates: unknown[] = [];

vi.mock("@/features/technicians/hooks/useTechniciansPage", () => ({
  useTechniciansPage: () => ({
    technicians: mockTechnicians,
    isLoading: false,
    search: "",
    setSearch: vi.fn(),
    statusFilter: "active",
    setStatusFilter: vi.fn(),
    dialogOpen: false,
    setDialogOpen: vi.fn(),
    editing: null,
    form: { name: "", phone: "", notes: "", is_active: true },
    setForm: vi.fn(),
    saveMutation: { isPending: false, mutate: vi.fn() },
    deleteMutation: { isPending: false, mutate: vi.fn() },
    toggleActiveMutation: { isPending: false, mutate: toggleActiveMock },
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
  getRangeDates: (range: string, current: { dateFrom: string; dateTo: string }) => (
    range === "custom" ? current : { dateFrom: "2026-05-01", dateTo: "2026-05-31" }
  ),
  useTechnicianMaterialControl: ({ state }: { state: unknown }) => {
    materialControlStates.push(state);
    return ({
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
          estimatedCost: 850,
          grossMargin: 950,
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
          costDeliveredValue: 850,
          costReturnedValue: 0,
          costNetValue: 850,
          grossMargin: 950,
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
        costDeliveredValue: 850,
        costReturnedValue: 0,
        costNetValue: 850,
        grossMargin: 950,
        remitos: 1,
        devoluciones: 0,
        clients: 1,
        jobs: 1,
      },
    },
    });
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <TechniciansPage />
    </MemoryRouter>,
  );
}

async function openTechniciansTab() {
  await userEvent.setup().click(screen.getByRole("tab", { name: "Tecnicos" }));
}

async function openFirstMaterialControl() {
  await openTechniciansTab();
  fireEvent.click(screen.getAllByRole("button", { name: /Ver control/i })[0]);
}

describe("TechniciansPage", () => {
  it("opens the daily board by default", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Tecnicos" })).toBeInTheDocument();
    expect(screen.getByText("Estado actual de tecnicos")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tablero diario" })).toHaveAttribute("data-state", "active");
  });

  it("renders the technicians tab with list and create action", async () => {
    renderPage();
    await openTechniciansTab();

    expect(screen.getByRole("button", { name: /Nuevo tecnico/i })).toBeInTheDocument();
    expect(screen.getByText("Juan Tecnico")).toBeInTheDocument();
    expect(screen.getByText("Ana Inactiva")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ver control/i })).toHaveLength(2);
  });

  it("allows toggling technician active state from the technicians tab", async () => {
    renderPage();
    await openTechniciansTab();

    fireEvent.click(screen.getByRole("button", { name: /Marcar inactivo/i }));

    expect(toggleActiveMock).toHaveBeenCalledWith({ id: "tech-1", isActive: false });
  });

  it("renders material control tab with this month as default date range", async () => {
    renderPage();

    await openFirstMaterialControl();

    expect(screen.getAllByText("Balance de materiales").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("2026-05-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-05-31")).toBeInTheDocument();
    expect(screen.getAllByText("Movimientos por tecnico").length).toBeGreaterThan(0);
    expect(screen.getByText("Movimientos detallados")).toBeInTheDocument();
  });

  it("enables custom date inputs and updates material control state", async () => {
    const user = userEvent.setup();
    renderPage();

    await openFirstMaterialControl();
    expect(screen.getByLabelText("Fecha desde")).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Rango" }));
    await user.click(screen.getByRole("option", { name: "Personalizado" }));

    const fromInput = screen.getByLabelText("Fecha desde");
    expect(fromInput).not.toBeDisabled();
    fireEvent.change(fromInput, { target: { value: "2026-05-05" } });

    await waitFor(() => {
      expect(materialControlStates.at(-1)).toMatchObject({ range: "custom", dateFrom: "2026-05-05" });
    });
  });

  it("renders printable material control summary and movements", async () => {
    renderPage();

    await openFirstMaterialControl();

    expect(screen.getByLabelText("Vista imprimible de movimientos")).toBeInTheDocument();
    expect(screen.getByText("Control de materiales por tecnico")).toBeInTheDocument();
    expect(screen.getByText("Documento interno de control. No reemplaza comprobantes fiscales.")).toBeInTheDocument();
  });

  it("does not use financial account language in the page", async () => {
    const { container } = renderPage();

    await openFirstMaterialControl();

    const text = container.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("deuda");
    expect(text).not.toContain("cuenta corriente");
    expect(text).not.toContain("saldo de cuenta");
    expect(text).not.toContain("pendiente de devolucion");
  });
});
