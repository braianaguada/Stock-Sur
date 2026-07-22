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
        description="Datos de prueba"
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
    expect(container).toBeDefined();

    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
