import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StockBadge } from "@/features/price-lists/components/StockBadge";

function renderBadge(total: number | undefined) {
  return render(
    <TooltipProvider delayDuration={0}>
      <StockBadge total={total} />
    </TooltipProvider>,
  );
}

describe("StockBadge", () => {
  it("identifies unavailable stock data", () => {
    renderBadge(undefined);

    expect(screen.getByText("S/D")).toHaveClass("text-muted-foreground");
  });

  it("identifies stock depletion and exposes its exact value", async () => {
    renderBadge(0);

    const badge = screen.getByText("Sin stock");
    expect(badge).toHaveClass("text-destructive");
    fireEvent.focus(badge.parentElement!);
    expect(await screen.findAllByText("Stock actual: 0")).not.toHaveLength(0);
  });

  it("formats available stock consistently and exposes its exact value", async () => {
    renderBadge(1234.56);

    const badge = screen.getByText("1.234,6");
    expect(badge).toHaveClass("text-success");
    fireEvent.focus(badge.parentElement!);
    expect(await screen.findAllByText("Stock actual: 1234.56")).not.toHaveLength(0);
  });
});
