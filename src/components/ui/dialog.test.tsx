import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { DialogActionGrid } from "@/components/ui/dialog";

describe("DialogActionGrid", () => {
  it("normalizes action size, alignment and responsive columns", () => {
    render(
      <DialogActionGrid columns={2}>
        <Button variant="ghost" size="icon">
          <span aria-hidden>+</span>
          Primera acción
        </Button>
        <Button variant="ghost">Segunda acción</Button>
      </DialogActionGrid>,
    );

    const grid = screen.getByText("Primera acción").closest('[data-slot="dialog-action-grid"]');
    expect(grid).toHaveAttribute("data-slot", "dialog-action-grid");
    expect(grid).toHaveClass(
      "sm:grid-cols-2",
      "[&_button]:h-10",
      "[&_button]:w-full",
      "[&_button]:justify-start",
    );
  });
});
