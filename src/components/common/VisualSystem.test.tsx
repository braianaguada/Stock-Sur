import { render, screen } from "@testing-library/react";
import { AmountDisplay, MetricCard, MetricHeroCard, OperationalTableShell } from "./VisualSystem";
import { PageHeader } from "@/components/ui/page";

describe("visual system components", () => {
  it("renders full currency values with a title", () => {
    render(<AmountDisplay value={123456789.99} />);

    const amount = screen.getByText("$ 123.456.789,99");
    expect(amount).toBeInTheDocument();
    expect(amount.getAttribute("title")?.replace(/\u00a0/g, " ")).toBe("$ 123.456.789,99");
  });

  it("renders metric card label, value and helper", () => {
    render(<MetricCard label="Efectivo neto" value={98765.43} helper="A rendir" />);

    expect(screen.getByText("Efectivo neto")).toBeInTheDocument();
    expect(screen.getByText("$ 98.765,43")).toBeInTheDocument();
    expect(screen.getByText("A rendir")).toBeInTheDocument();
  });

  it("renders a hero metric", () => {
    render(<MetricHeroCard label="Total del dia" value={555000} helper="Ventas del dia" />);

    expect(screen.getByText("Total del dia")).toBeInTheDocument();
    expect(screen.getByText("$ 555.000,00")).toBeInTheDocument();
    expect(screen.getByText("Ventas del dia")).toBeInTheDocument();
  });

  it("renders page header title, description and action", () => {
    render(
      <PageHeader
        eyebrow="Caja y cierre diario"
        title="Caja"
        description="Panel operativo diario."
        actions={<button type="button">Nueva venta</button>}
      />,
    );

    expect(screen.getByText("Caja y cierre diario")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Caja" })).toBeInTheDocument();
    expect(screen.getByText("Panel operativo diario.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva venta" })).toBeInTheDocument();
  });

  it("renders operational table shell metadata", () => {
    render(
      <OperationalTableShell title="Movimientos" description="Control diario" count={2}>
        <div>Tabla</div>
      </OperationalTableShell>,
    );

    expect(screen.getByText("Movimientos")).toBeInTheDocument();
    expect(screen.getByText("Control diario")).toBeInTheDocument();
    expect(screen.getByText("2 registros")).toBeInTheDocument();
    expect(screen.getByText("Tabla")).toBeInTheDocument();
  });
});
