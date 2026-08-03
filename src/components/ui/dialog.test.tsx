import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActionGrid,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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

describe("DialogContent", () => {
  it("uses an opaque semantic surface with stable contrast", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Confirmar operación</DialogTitle>
          <DialogDescription>Revisá los datos antes de continuar.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "z-50",
      "border-border",
      "bg-background",
      "text-foreground",
      "shadow-[var(--shadow-md)]",
    );
  });
});
