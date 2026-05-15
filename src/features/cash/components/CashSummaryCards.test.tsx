import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { CashOverviewPanel } from "./CashSummaryCards";
import type { CashSummary } from "../types";

const summary: CashSummary = {
  efectivoRemito: 1000000,
  efectivoFacturable: 200000,
  serviciosRemito: 30000,
  point: 40000,
  transferencia: 50000,
  cuentaCorriente: 60000,
  total: 1380000,
  pendientes: 0,
  gastosTotal: 15000,
  gastosEfectivo: 10000,
  gastosNoEfectivo: 5000,
  efectivoAntesGastos: 1200000,
  efectivoNetoEsperado: 1190000,
};

describe("CashOverviewPanel", () => {
  it("renders the day total and large values without truncation", () => {
    render(<CashOverviewPanel summary={summary} closureStatus="ABIERTO" movementCount={4} />);

    expect(screen.getByText("Total vendido del dia")).toBeInTheDocument();
    expect(screen.getByText("$ 1.380.000,00")).toBeInTheDocument();
    expect(screen.getAllByText("$ 1.190.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Caja abierta")).toBeInTheDocument();
  });

  it("keeps cash and non-cash expenses separated", () => {
    render(<CashOverviewPanel summary={summary} />);

    expect(screen.getByText("Gastos efectivo")).toBeInTheDocument();
    expect(screen.getByText("$ 10.000,00")).toBeInTheDocument();
    expect(screen.getByText("Gastos no efectivo: $ 5.000,00")).toBeInTheDocument();
  });

  it("only promotes pending receipts when there are pending items", () => {
    const onReviewPending = vi.fn();
    const pendingSummary = { ...summary, pendientes: 2 };
    render(<CashOverviewPanel summary={pendingSummary} pendingCount={2} onReviewPending={onReviewPending} />);

    expect(screen.getByRole("button", { name: /revisar pendientes/i })).toBeInTheDocument();
    expect(screen.getByText("2 pendientes")).toBeInTheDocument();
  });
});
