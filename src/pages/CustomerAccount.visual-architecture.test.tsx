import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import CustomerAccountPage from "./CustomerAccount";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentCompany: { id: "company-1" } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/features/customer-account/hooks/useCustomerAccountStatement", () => ({
  useCustomerAccountStatement: () => ({
    data: {
      summary: {
        balance: 1850,
        overdueDebt: 700,
        notDueDebt: 1150,
        periodPayments: 500,
        movementsCount: 1,
      },
      rows: [
        {
          id: "entry-1",
          business_date: "2026-07-14",
          due_date: "2026-08-13",
          customer_name: "Cliente Norte",
          origin_label: "Documento",
          reference: "REMITO 0001-00000012",
          description: "Venta en cuenta corriente",
          debit: 2350,
          credit: 500,
          running_balance: 1850,
          status: "partial",
          document_id: null,
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

describe("CustomerAccountPage visual architecture", () => {
  it("gives the account balance a single dominant hierarchy", () => {
    render(<CustomerAccountPage />, { wrapper: MemoryRouter });

    const balance = screen.getByText("Saldo total").closest("div");
    expect(balance).not.toBeNull();
    expect(within(balance!).getByText(/1\.850/)).toBeInTheDocument();
    expect(screen.getByText("Deuda vencida")).toBeInTheDocument();
    expect(screen.getByText("Deuda no vencida")).toBeInTheDocument();
    expect(screen.getByText("Pagos del período")).toBeInTheDocument();
  });

  it("uses the shared operational shell and keeps financial columns visible", () => {
    render(<CustomerAccountPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole("heading", { name: "Movimientos de cuenta" })).toBeInTheDocument();
    expect(screen.getByText("1 registros")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Débito" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Crédito" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Saldo" })).toBeInTheDocument();
  });
});
