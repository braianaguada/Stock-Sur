import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: { id: "user-1", email: "admin@stocksur.test" },
    roles: ["admin"],
    companies: [{ id: "company-1", name: "Empresa Demo", slug: "empresa-demo", status: "ACTIVE" }],
    currentCompany: { id: "company-1", name: "Empresa Demo", slug: "empresa-demo", status: "ACTIVE" },
    companyRoleCodes: [],
    companyPermissionCodes: [],
    setCurrentCompanyId: vi.fn(),
  }),
}));

vi.mock("@/contexts/company-brand-context", () => ({
  useCompanyBrand: () => ({
    settings: {
      app_name: "Stock Sur",
      logo_url: null,
      primary_color: "#123456",
      secondary_color: "#654321",
      accent_color: "#abcdef",
    },
  }),
}));

describe("AppLayout", () => {
  const renderLayout = (initialPath = "/items", children: ReactNode = <div>contenido demo</div>) =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <AppLayout>{children}</AppLayout>
      </MemoryRouter>,
    );

  it("renders the branded shell with sidebar navigation", () => {
    renderLayout();

    expect(screen.getAllByText("Stock Sur")).toHaveLength(2);
    expect(screen.getAllByText("Empresa Demo")).toHaveLength(2);
    expect(screen.getByText("Sistema interno de gestión comercial y stock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ítems" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(screen.getByText("contenido demo")).toBeInTheDocument();
  });

  it("can collapse the sidebar without breaking navigation state", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Contraer menú lateral" }));

    expect(screen.getByRole("button", { name: "Expandir menú lateral" })).toBeInTheDocument();
    expect(screen.queryByText("Ítems")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/items");
  });
});
