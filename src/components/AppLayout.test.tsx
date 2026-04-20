import { render, screen } from "@testing-library/react";
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
      app_name: "Empresa Demo",
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
      <MemoryRouter
        initialEntries={[initialPath]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AppLayout>{children}</AppLayout>
      </MemoryRouter>,
    );

  it("renders the branded shell with navigation and account actions", () => {
    renderLayout();

    expect(screen.getByText("Empresa Demo")).toBeInTheDocument();
    expect(screen.getByText("Gestión comercial")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Configuración" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(screen.getByText("admin@stocksur.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByText("contenido demo")).toBeInTheDocument();
  });

  it("updates the active navigation state for the current route", () => {
    renderLayout("/cash");

    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/cash");
  });
});
