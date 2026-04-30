import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    session: { user: { id: "test-user" } },
    loading: false,
    user: { id: "test-user" },
    roles: ["admin"],
    companies: [{ id: "company-1", name: "Empresa Demo", slug: "empresa-demo", status: "ACTIVE" }],
    currentCompany: { id: "company-1", name: "Empresa Demo", slug: "empresa-demo", status: "ACTIVE" },
    companyRoleCodes: [],
    companyPermissionCodes: [],
    isAdmin: true,
    setCurrentCompanyId: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/CompanyBrandProvider", () => ({
  CompanyBrandProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./pages/Index", () => ({ default: () => <div>route:index</div> }));
vi.mock("./pages/Auth", () => ({ default: () => <div>route:auth</div> }));
vi.mock("./pages/Items", () => ({ default: () => <div>route:items</div> }));
vi.mock("./pages/Stock", () => ({ default: () => <div>route:stock</div> }));
vi.mock("./pages/Suppliers", () => ({ default: () => <div>route:suppliers</div> }));
vi.mock("./pages/PriceLists", () => ({ default: () => <div>route:price-lists</div> }));
vi.mock("./pages/Imports", () => ({ default: () => <div>route:imports</div> }));
vi.mock("./pages/Quotes", () => ({ default: () => <div>route:quotes</div> }));
vi.mock("./pages/Documents", () => ({ default: () => <div>route:documents</div> }));
vi.mock("./pages/ServiceDocuments", () => ({ default: () => <div>route:service-documents</div> }));
vi.mock("./pages/Cash", () => ({ default: () => <div>route:cash</div> }));
vi.mock("./pages/Customers", () => ({ default: () => <div>route:customers</div> }));
vi.mock("./pages/Users", () => ({ default: () => <div>route:users</div> }));
vi.mock("./pages/LegacyCatalogImport", () => ({ default: () => <div>route:legacy-import</div> }));
vi.mock("./pages/Settings", () => ({ default: () => <div>route:settings</div> }));
vi.mock("./pages/NotFound", () => ({ default: () => <div>route:not-found</div> }));

import App from "./App";

describe("App route smoke test", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    ["/", "route:index"],
    ["/items", "route:items"],
    ["/stock", "route:stock"],
    ["/suppliers", "route:suppliers"],
    ["/price-lists", "route:price-lists"],
    ["/imports", "route:imports"],
    ["/quotes", "route:quotes"],
    ["/documents", "route:documents"],
    ["/services/documents", "route:service-documents"],
    ["/cash", "route:cash"],
    ["/customers", "route:customers"],
    ["/users", "route:users"],
    ["/settings", "route:settings"],
    ["/items/catalog/import-legacy", "route:legacy-import"],
    ["/pending", "route:not-found"],
  ])("mounts %s without crashing", async (path, expectedText) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });
});
