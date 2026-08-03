import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

Object.defineProperties(window.HTMLElement.prototype, {
  hasPointerCapture: { configurable: true, value: () => false },
  releasePointerCapture: { configurable: true, value: () => {} },
  setPointerCapture: { configurable: true, value: () => {} },
});

describe("SelectContent", () => {
  it("renders an opaque, theme-aware overlay with a visible focus state", async () => {
    const user = userEvent.setup();

    render(
      <Select defaultValue="cash">
        <SelectTrigger aria-label="Medio de pago">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">Efectivo</SelectItem>
          <SelectItem value="transfer">Transferencia</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox", { name: "Medio de pago" }));

    await screen.findByRole("listbox");
    const content = document.querySelector<HTMLElement>(".bg-popover");
    expect(content).not.toBeNull();
    expect(content).toHaveClass(
      "z-50",
      "border-border",
      "bg-popover",
      "text-popover-foreground",
      "shadow-[var(--shadow-md)]",
    );
    expect(content).not.toHaveClass("border-white/70", "bg-popover/98", "backdrop-blur-sm");

    expect(screen.getByRole("option", { name: "Transferencia" })).toHaveClass(
      "focus:bg-accent",
      "focus:text-accent-foreground",
    );
  });
});
