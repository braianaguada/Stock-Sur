import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentConfirmationDialog } from "./DocumentConfirmationDialog";

describe("DocumentConfirmationDialog", () => {
  it("explains the consequence and only runs the action after confirmation", () => {
    const onConfirm = vi.fn();

    render(
      <DocumentConfirmationDialog
        open
        title="Emitir remito"
        description="Se registrara la salida de stock de todas las lineas."
        confirmLabel="Emitir remito"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText("Se registrara la salida de stock de todas las lineas.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Emitir remito" })).toHaveClass("text-foreground");
    expect(screen.getByText("Se registrara la salida de stock de todas las lineas.")).toHaveClass("text-muted-foreground");
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Emitir remito" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("blocks both decisions while an action is pending", () => {
    render(
      <DocumentConfirmationDialog
        open
        title="Anular documento"
        description="La accion no se puede deshacer."
        confirmLabel="Anular documento"
        tone="danger"
        isPending
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Procesando..." })).toBeDisabled();
  });
});
