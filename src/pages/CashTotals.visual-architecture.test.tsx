import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import CashTotalsPage from "./CashTotals";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentCompany: { id: "company-1" } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      summary: {
        businessDate: "__summary__",
        salesCount: 4,
        pendingReceiptCount: 0,
        grossSalesTotal: 2100,
        cashTotal: 1500,
        cashRemitoTotal: 1000,
        cashFacturableTotal: 500,
        servicesRemitoTotal: 0,
        transferTotal: 100,
        mercadoPagoTotal: 200,
        cardTotal: 200,
        accountCurrentTotal: 300,
        otherPaymentTotal: 0,
        expensesCashTotal: 100,
        expensesNonCashTotal: 50,
        expensesTotal: 150,
        adjustmentsTotal: -200,
        returnsTotal: 200,
        netCashTotal: 1400,
        netTotal: 1950,
      },
      days: [
        {
          businessDate: "2026-07-14",
          salesCount: 4,
          pendingReceiptCount: 0,
          grossSalesTotal: 2100,
          cashTotal: 1500,
          cashRemitoTotal: 1000,
          cashFacturableTotal: 500,
          servicesRemitoTotal: 0,
          transferTotal: 100,
          mercadoPagoTotal: 200,
          cardTotal: 200,
          accountCurrentTotal: 300,
          otherPaymentTotal: 0,
          expensesCashTotal: 100,
          expensesNonCashTotal: 50,
          expensesTotal: 150,
          adjustmentsTotal: -200,
          returnsTotal: 200,
          netCashTotal: 1400,
          netTotal: 1950,
        },
      ],
    },
    error: null,
    isLoading: false,
    isFetching: false,
  }),
}));

describe("CashTotalsPage visual architecture", () => {
  it("gives the sold total a single dominant financial hierarchy", () => {
    render(<CashTotalsPage />);

    const soldTotal = screen.getByText("Total vendido").closest("div");
    expect(soldTotal).not.toBeNull();
    expect(within(soldTotal!).getByText(/2\.100/)).toBeInTheDocument();
    expect(screen.getAllByText("Efectivo neto")).toHaveLength(2);
    expect(screen.getByText("Gastos totales")).toBeInTheDocument();
  });

  it("uses the shared operational table shell for the daily breakdown", () => {
    render(<CashTotalsPage />);

    expect(screen.getByRole("heading", { name: "Totales agrupados por día" })).toBeInTheDocument();
    expect(screen.getByText("1 registro")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Efectivo neto" })).toBeInTheDocument();
  });
});
