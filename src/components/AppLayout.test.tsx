import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";

const baseCompany = { id: "company-1", name: "Empresa Demo", slug: "empresa-demo", status: "ACTIVE" };
const secondCompany = { id: "company-2", name: "Empresa Asignada", slug: "empresa-asignada", status: "ACTIVE" };

let authState = {
  signOut: vi.fn(),
  user: { id: "user-1", email: "admin@stocksur.test" },
  roles: ["admin"],
  companies: [baseCompany, secondCompany],
  currentCompany: baseCompany,
  companyRoleCodes: [],
  companyPermissionCodes: [],
  loading: false,
  switchingCompany: false,
  switchCompany: vi.fn(),
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
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
  beforeEach(() => {
    authState = {
      signOut: vi.fn(),
      user: { id: "user-1", email: "admin@stocksur.test" },
      roles: ["admin"],
      companies: [baseCompany, secondCompany],
      currentCompany: baseCompany,
      companyRoleCodes: [],
      companyPermissionCodes: [],
      loading: false,
      switchingCompany: false,
      switchCompany: vi.fn(),
    };
  });

  const renderLayout = (initialPath = "/items", children: ReactNode = <div>contenido demo</div>) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[initialPath]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppLayout>{children}</AppLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it("renders the branded shell with navigation, account actions and company selector", () => {
    renderLayout();

    expect(screen.getAllByText("Empresa Demo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Gesti/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tecnicos" })).toHaveAttribute("href", "/technicians");
    expect(screen.getByRole("link", { name: "Rendiciones" })).toHaveAttribute("href", "/settlements");
    expect(screen.getByRole("link", { name: /Configuraci/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(screen.getByText("admin@stocksur.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerrar sesi/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("contenido demo")).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: /Navegación principal/i });
    expect(navigation).toHaveClass("overflow-x-auto");
    expect(navigation.firstElementChild).toHaveClass("flex-nowrap", "w-max");
    expect(screen.getByText("contenido demo").parentElement).toHaveClass("px-4", "sm:px-6");
  });

  it("updates the active navigation state for the current route", () => {
    renderLayout("/cash");

    expect(screen.getByRole("link", { current: "page" })).toHaveAttribute("href", "/cash");
  });

  it("shows a static company label instead of a selector when there is one company", () => {
    authState = {
      ...authState,
      companies: [baseCompany],
      currentCompany: baseCompany,
    };

    renderLayout();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByText("Empresa Demo").length).toBeGreaterThan(0);
  });

  it("blocks operational content when the user has no active company", () => {
    authState = {
      ...authState,
      companies: [],
      currentCompany: null,
    };

    renderLayout();

    expect(screen.getByText("Tu usuario no tiene acceso a ninguna empresa activa.")).toBeInTheDocument();
    expect(screen.queryByText("contenido demo")).not.toBeInTheDocument();
  });
});
