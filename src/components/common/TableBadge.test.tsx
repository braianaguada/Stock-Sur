import { render, screen } from "@testing-library/react";
import { TableBadge } from "./TableBadge";

describe("TableBadge", () => {
  it("keeps the shared compact table style while applying a semantic tone", () => {
    render(<TableBadge tone="success">Activo</TableBadge>);

    const badge = screen.getByText("Activo");
    expect(badge).toHaveClass("h-5", "px-1.5", "text-[10px]", "bg-success/10");
  });
});
