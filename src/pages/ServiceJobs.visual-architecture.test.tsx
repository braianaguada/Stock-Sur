import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceJobListItem } from "@/features/service-jobs/types";
import ServiceJobsPage from "./ServiceJobs";

const mutate = vi.fn();
let jobs: ServiceJobListItem[] = [];

const job: ServiceJobListItem = {
  id: "job-1",
  company_id: "company-1",
  customer_id: "customer-1",
  title: "Instalación sucursal norte",
  description: "Instalación y puesta en marcha",
  status: "IN_PROGRESS",
  priority: "HIGH",
  opened_at: "2026-07-15T09:00:00Z",
  closed_at: null,
  archived_at: null,
  archived_by: null,
  created_by: "user-1",
  created_at: "2026-07-15T09:00:00Z",
  updated_at: "2026-07-15T10:00:00Z",
  customers: { id: "customer-1", name: "Cliente Norte" },
  serviceCount: 2,
  technicianNames: ["Ana Técnica"],
  remitoCount: 1,
  materialLineCount: 3,
  materialTotal: 20_000,
  estimatedMaterialCost: 12_000,
  doneServiceCount: 1,
  pendingServiceCount: 1,
  lastActivityAt: "2026-07-15T10:00:00Z",
  canDelete: false,
  deleteBlockedReason: "Tiene servicios asociados",
  hasLinkedDocuments: true,
};

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentCompany: { id: "company-1" }, user: { id: "user-1" } }),
}));

vi.mock("@/contexts/company-brand-context", () => ({
  useCompanyBrand: () => ({ settings: { default_point_of_sale: 1 } }),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("@/features/service-jobs/hooks/useServiceJobs", () => ({
  useServiceJobs: ({ search }: { search: string }) => ({
    customers: [{ id: "customer-1", name: "Cliente Norte" }],
    technicians: [{ id: "technician-1", name: "Ana Técnica" }],
    jobs: search ? [] : jobs,
    servicesByJobId: new Map(),
    linkableRemitos: [],
    isLoading: false,
    saveJobMutation: { isPending: false, mutate },
    archiveJobMutation: { isPending: false, mutate },
    restoreJobMutation: { isPending: false, mutate },
    deleteJobMutation: { isPending: false, mutate },
    saveServiceMutation: { isPending: false, mutate },
    deleteServiceMutation: { isPending: false, mutate },
    createMaterialRemitoMutation: { isPending: false, mutate },
    linkMaterialRemitoMutation: { isPending: false, mutate },
    unlinkMaterialRemitoMutation: { isPending: false, mutate },
  }),
}));

describe("ServiceJobsPage visual architecture", () => {
  beforeEach(() => {
    jobs = [job];
    mutate.mockClear();
  });

  it("presents an operational summary and responsive job selectors", () => {
    render(<MemoryRouter><ServiceJobsPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Trabajos y servicios" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bandeja de trabajos" }).closest("[class*='min-w-0']")).toBeInTheDocument();
    expect(screen.getByText("1 registro")).toBeInTheDocument();
    expect(screen.getByTestId("service-job-mobile-list")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Instalación sucursal norte.*Cliente Norte.*En curso/s })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("columnheader", { name: "Operación" })).toBeInTheDocument();
    expect(screen.getAllByText("Ana Técnica").length).toBeGreaterThan(0);
  });

  it("explains an empty filter result and restores the active list", () => {
    render(<MemoryRouter><ServiceJobsPage /></MemoryRouter>);

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar trabajos" }), { target: { value: "inexistente" } });
    expect(screen.getByText("No hay trabajos que coincidan")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Limpiar filtros" })[0]);
    expect(screen.getAllByText("Instalación sucursal norte").length).toBeGreaterThan(0);
  });
});
