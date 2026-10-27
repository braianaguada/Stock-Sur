import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualQuoteLineEditor } from "./ManualQuoteLineEditor";
import { createManualQuoteLine } from "../lib/manual-quote";

describe("manual quotation editor", () => {
  it("edits a free product and calculates a quote while allowing a final price override", () => {
    const remove = vi.fn();
    function Editor() {
      const [line, setLine] = useState(createManualQuoteLine);
      return <ManualQuoteLineEditor line={line} onChange={setLine} onRemove={remove} formatMoney={(value) => value.toFixed(2)} />;
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Descripcion"), { target: { value: "Manguera" } });
    fireEvent.change(screen.getByLabelText("Costo unitario sin IVA ($)"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Flete %"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Recargo %"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "2" } });
    expect(screen.getByLabelText("Precio final unitario ($)")).toHaveValue(1730.3);
    expect(screen.getByText("Total: 3460.60")).toBeInTheDocument();
    expect(screen.getByLabelText("IVA %")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Precio final unitario ($)"), { target: { value: "1700" } });
    expect(screen.getByText("Total: 3400.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar precio calculado" }));
    expect(screen.getByLabelText("Precio final unitario ($)")).toHaveValue(1730.3);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar producto manual Manguera" }));
    expect(remove).toHaveBeenCalledOnce();
  });
});
