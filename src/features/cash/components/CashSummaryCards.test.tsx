import { render, screen } from "@testing-library/react";
import { CashSummaryCards } from "./CashSummaryCards";
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

describe("CashSummaryCards", () => {
  it("renders the day total and large values without truncation", () => {
    render(<CashSummaryCards summary={summary} />);

    expect(screen.getByText("Total del dia")).toBeInTheDocument();
    expect(screen.getByText("$ 1.380.000,00")).toBeInTheDocument();
    expect(screen.getAllByText("$ 1.190.000,00").length).toBeGreaterThan(0);
  });

  it("keeps cash and non-cash expenses separated", () => {
    render(<CashSummaryCards summary={summary} />);

    expect(screen.getByText("Gastos efectivo")).toBeInTheDocument();
    expect(screen.getByText("$ 10.000,00")).toBeInTheDocument();
    expect(screen.getByText("Gastos no efectivo")).toBeInTheDocument();
    expect(screen.getByText("$ 5.000,00")).toBeInTheDocument();
  });
});
