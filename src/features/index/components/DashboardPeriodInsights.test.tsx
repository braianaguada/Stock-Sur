import { render, screen } from "@testing-library/react";
import { DashboardPeriodInsights } from "./DashboardPeriodInsights";

describe("DashboardPeriodInsights", () => {
  it("identifies variants by attributes and retains quantities and units", () => {
    render(<DashboardPeriodInsights loading={false} data={{ timeseries: { buckets: [] }, products: {
      totals: { revenue: 300, cost: 100, grossProfit: 200, quantity: 3 },
      topItems: [
        { itemId: "a", name: "CAÑO COBRE", attributes: "1/4", sku: "ITM-1", unit: "m", quantity: 2, revenue: 200, cost: 60, grossProfit: 140 },
        { itemId: "b", name: "CAÑO COBRE", attributes: "3/8", sku: "ITM-2", unit: "m", quantity: 1, revenue: 100, cost: 40, grossProfit: 60 },
      ],
    } }} />);
    expect(screen.getByText("CAÑO COBRE - 1/4")).toBeInTheDocument();
    expect(screen.getByText("CAÑO COBRE - 3/8")).toBeInTheDocument();
    expect(screen.getByText("ITM-1")).toBeInTheDocument();
    expect(screen.getByText("2 m")).toBeInTheDocument();
    expect(screen.getByText("1 m")).toBeInTheDocument();
    expect(screen.getAllByText("Cantidad vendida")).toHaveLength(3);
    expect(screen.getByText("Sin movimientos en el período.")).toBeInTheDocument();
  });
});
