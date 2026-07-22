import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { EntityDialog } from "./EntityDialog";

describe("EntityDialog visual and accessibility contract", () => {
  it("keeps header and footer outside the scrollable body and closes with Escape", async () => {
    const onOpenChange = vi.fn();

    const { container } = render(
      <EntityDialog
        open
        onOpenChange={onOpenChange}
        title="Editar entidad"
        footer={<Button>Guardar</Button>}
      >
        <input aria-label="Nombre" />
      </EntityDialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("overflow-hidden", "flex", "max-w-[640px]");
    expect(document.querySelector('[data-slot="dialog-body"]')).toHaveClass("overflow-y-auto");
    expect(document.querySelector('[data-slot="dialog-header"]')).toHaveClass("shrink-0");
    expect(document.querySelector('[data-slot="dialog-footer"]')).toHaveClass("shrink-0");
    expect(screen.getByText("Información y acciones de Editar entidad.")).toHaveClass("sr-only");
    expect(container).toBeDefined();

    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns focus to the control that opened a controlled dialog", async () => {
    const user = userEvent.setup();

    function ControlledDialog() {
      const [open, setOpen] = useState(false);

      return (
        <>
          <Button onClick={() => setOpen(true)}>Nueva entidad</Button>
          <EntityDialog open={open} onOpenChange={setOpen} title="Nueva entidad" description="Datos de la entidad">
            <input aria-label="Nombre" />
          </EntityDialog>
        </>
      );
    }

    render(<ControlledDialog />);
    const trigger = screen.getByRole("button", { name: "Nueva entidad" });

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(trigger).toHaveFocus();
  });
});
