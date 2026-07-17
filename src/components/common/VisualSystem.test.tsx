import { render, screen } from "@testing-library/react";
import { AmountDisplay, MetricCard, MetricHeroCard, OperationalTableShell } from "./VisualSystem";
import { PageHeader, StatCard } from "@/components/ui/page";

describe("visual system components", () => {
  it("renders full currency values with a title", () => {
    render(<AmountDisplay value={123456789.99} />);

    const amount = screen.getByText("$ 123.456.789,99");
    expect(amount).toBeInTheDocument();
    expect(amount).toHaveClass("whitespace-nowrap", "tabular-nums");
    expect(amount).not.toHaveClass("overflow-x-auto");
    expect(amount).not.toHaveClass("overflow-hidden", "text-ellipsis");
    expect(amount).not.toHaveClass("break-words");
    expect(amount.getAttribute("title")?.replace(/\u00a0/g, " ")).toBe("$ 123.456.789,99");
  });

  it("enables horizontal amount scrolling only when requested", () => {
    render(<AmountDisplay value={123456789.99} allowHorizontalScroll />);

    const amount = screen.getByText("$ 123.456.789,99");
    expect(amount).toHaveClass("overflow-x-auto", "[scrollbar-width:thin]");
  });

  it("renders metric card label, value and helper", () => {
    render(<MetricCard label="Efectivo neto" value={98765.43} helper="A rendir" />);

    expect(screen.getByText("Efectivo neto")).toBeInTheDocument();
    expect(screen.getByText("$ 98.765,43")).toBeInTheDocument();
    expect(screen.getByText("A rendir")).toBeInTheDocument();
  });

  it("applies the shared metric tone to stat cards", () => {
    render(
      <StatCard
        label="Alertas"
        value="3"
        tone="warning"
        icon={<span data-testid="warning-icon">!</span>}
      />,
    );

    expect(screen.getByText("3")).toHaveClass("text-warning");
    expect(screen.getByTestId("warning-icon").parentElement).toHaveClass(
      "border-warning/18",
      "bg-warning/12",
      "text-warning",
    );
    expect(screen.getByText("Alertas").closest("[class*='stat-tile']")).toHaveClass(
      "before:bg-warning/80",
    );
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

  it("keeps page header tabs in a responsive horizontal strip", () => {
    render(
      <PageHeader
        title="Stock"
        tabs={[
          { label: "Existencias", value: "inventory" },
          { label: "Movimientos", value: "movements" },
        ]}
        activeTab="inventory"
      />,
    );

    expect(screen.getByTestId("page-header-tabs")).toHaveClass("overflow-x-auto", "max-w-full");
    expect(screen.getByRole("tablist")).toHaveClass("w-max", "min-w-full");
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
