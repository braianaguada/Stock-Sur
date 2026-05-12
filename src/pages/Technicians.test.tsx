import { render, screen } from "@testing-library/react";
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

vi.mock("@/features/technicians/hooks/useTechniciansPage", () => ({
  useTechniciansPage: () => ({
    technicians: [],
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

describe("TechniciansPage", () => {
  it("renders the empty state and create action", () => {
    render(<TechniciansPage />);

    expect(screen.getByRole("heading", { name: "Tecnicos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo tecnico/i })).toBeInTheDocument();
    expect(screen.getByText("No hay tecnicos cargados.")).toBeInTheDocument();
  });
});
