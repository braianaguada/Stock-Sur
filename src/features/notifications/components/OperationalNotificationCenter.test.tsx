import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalNotificationCenter } from "./OperationalNotificationCenter";

const state = vi.hoisted(() => ({
  currentCompany: { id: "company-1", name: "Empresa uno" },
  roles: ["admin"],
  companyRoleCodes: [],
  companyPermissionCodes: [] as string[],
  loading: false,
}));
const dashboard = vi.hoisted(() => ({
  dashboard: { actions: [
    { key: "pending-receipts", label: "Comprobantes pendientes", count: 3, detail: "Revisar caja", href: "/cash", tone: "warning" },
    { key: "open-jobs", label: "Trabajos abiertos", count: 2, detail: "Revisar trabajos", href: "/service-jobs", tone: "danger" },
  ] },
  error: null,
  isLoading: false,
  isFetching: false,
  refetch: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@/features/index/hooks/useDashboardStats", () => ({ useDashboardStats: () => dashboard }));

const renderCenter = () => render(<MemoryRouter><OperationalNotificationCenter /></MemoryRouter>);

describe("OperationalNotificationCenter", () => {
  beforeEach(() => {
    state.roles = ["admin"];
    state.companyPermissionCodes = [];
    dashboard.error = null;
  });

  it("opens a contextual preview on hover without moving keyboard focus", () => {
    renderCenter();
    const trigger = screen.getByRole("button", { name: "Alertas operativas: 5 pendientes" });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("region", { name: "Notificaciones" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).not.toHaveFocus();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens on click and leads to the full center with focus restored on close", async () => {
    renderCenter();
    const trigger = screen.getByRole("button", { name: "Alertas operativas: 5 pendientes" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las notificaciones" }));
    const dialog = await screen.findByRole("dialog", { name: "Centro de alertas" });
    expect(within(dialog).getByRole("link", { name: /Trabajos abiertos/ })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
  });

  it("closes outside and applies permissions to the preview", () => {
    state.roles = ["user"];
    state.companyPermissionCodes = ["cash.view"];
    renderCenter();
    fireEvent.focus(screen.getByRole("button", { name: "Alertas operativas: 3 pendientes" }));
    expect(screen.getByRole("link", { name: /Comprobantes pendientes/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Trabajos abiertos/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: "Notificaciones" })).not.toBeInTheDocument();
  });
});
