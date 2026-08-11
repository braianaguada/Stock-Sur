import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AmountDisplay, CategoryBadge, HealthBadge, MetricCard, MetricGrid, MoneyCell, StatusBadge } from "./VisualSystem";
import { PageContainer, PageHeader } from "@/components/ui/page";

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

  it("applies the shared metric tone and vertically centers metric content", () => {
    render(<MetricCard label="Alertas" value={3} format="plain" tone="warning" icon={<span data-testid="warning-icon">!</span>} />);

    expect(screen.getByTestId("warning-icon").parentElement).toHaveClass("border-warning/18", "bg-warning/12", "text-warning");
    expect(screen.getByText("Alertas").closest("[class*='items-center']")).toHaveClass("h-full", "items-center");
  });

  it("keeps canonical three-column metrics above their readable minimum width", () => {
    const { container } = render(
      <MetricGrid columns={3}>
        <MetricCard label="Total del día" value={555000} helper="Ventas del día" />
      </MetricGrid>,
    );

    expect(container.firstElementChild).toHaveClass("grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]");
    expect(screen.getByText("Total del día").closest("[class*='h-full']")).toHaveClass("h-full");
    expect(screen.getByText("Total del día").closest("[class*='relative']")).not.toHaveClass("overflow-hidden");
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
    expect(screen.getByRole("heading", { name: "Caja" }).parentElement?.parentElement)
      .toHaveClass("lg:min-w-[min(100%,28rem)]", "lg:flex-1");
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

  it("exposes page archetypes without changing the default contract", () => {
    const { container } = render(
      <PageContainer archetype="workspace">
        <PageHeader title="Documentos" variant="workspace" />
      </PageContainer>,
    );

    expect(container.firstElementChild).toHaveClass("max-w-[var(--content-max)]");
    expect(container.firstElementChild).not.toHaveClass("px-4", "sm:px-6", "lg:px-8");
    expect(screen.getByRole("heading", { name: "Documentos" }).closest("section"))
      .toHaveAttribute("data-variant", "workspace");
  });

  it("keeps domain categories separate from functional status and aligns money", () => {
    render(
      <div>
        <CategoryBadge>Remito</CategoryBadge>
        <MoneyCell value={1250.5} />
      </div>,
    );

    expect(screen.getByText("Remito")).toHaveClass("border-primary/20", "bg-primary/8");
    expect(screen.getByText("$ 1.250,50")).toHaveClass("text-right", "tabular-nums");
  });

  it("keeps contextual badges on one palette while preserving health semantics", () => {
    render(
      <>
        <StatusBadge tone="info">Enviado</StatusBadge>
        <CategoryBadge>Salida</CategoryBadge>
        <HealthBadge tone="danger">Sin stock</HealthBadge>
      </>,
    );

    expect(screen.getByText("Enviado")).toHaveClass("text-info", "normal-case", "tracking-normal");
    expect(screen.getByText("Salida")).toHaveClass("text-primary");
    expect(screen.getByText("Sin stock")).toHaveClass("text-destructive");
    expect(screen.getByText("Enviado")).toHaveAttribute("data-badge-kind", "status");
    expect(screen.getByText("Enviado")).toHaveAttribute("data-badge-tone", "info");
    expect(screen.getByText("Salida")).toHaveAttribute("data-badge-kind", "category");
  });

  it("preserves the boolean health shorthand", () => {
    render(
      <>
        <HealthBadge healthy>Disponible</HealthBadge>
        <HealthBadge healthy={false}>Atención</HealthBadge>
      </>,
    );

    expect(screen.getByText("Disponible")).toHaveClass("text-success");
    expect(screen.getByText("Atención")).toHaveClass("text-warning");
  });
});
