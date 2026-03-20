import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

function BrokenComponent() {
  throw new Error("Boom de prueba");
}

describe("AppErrorBoundary", () => {
  it("renders a recovery screen instead of a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: /la pantalla encontró un error/i })).toBeInTheDocument();
    expect(screen.getByText(/boom de prueba/i)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("lets the user reload the app from the fallback screen", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload: reloadSpy },
    });

    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: /recargar/i }));
    expect(reloadSpy).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
