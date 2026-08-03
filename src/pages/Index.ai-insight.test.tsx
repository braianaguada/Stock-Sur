import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DASHBOARD } from "@/features/index/dashboard-insights";
import { DashboardAiInsight } from "@/pages/Index";

const { mutate } = vi.hoisted(() => ({
  mutate: vi.fn(),
}));

vi.mock("@/features/index/hooks/useDashboardAiSummary", () => ({
  useDashboardAiSummary: () => ({
    data: undefined,
    isPending: false,
    mutate,
  }),
}));

describe("DashboardAiInsight", () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  it("separa el bloque y adapta la acción entre mobile y escritorio", () => {
    render(<DashboardAiInsight companyName="Stock Sur" dashboard={EMPTY_DASHBOARD} />);

    const title = screen.getByRole("heading", { name: "Lectura ejecutiva bajo demanda" });
    const card = title.closest("[aria-labelledby='dashboard-ai-title']");
    const action = screen.getByRole("button", { name: "Generar lectura" });

    expect(card).toHaveClass("mt-5");
    expect(action).toHaveClass("w-full", "sm:w-auto", "lg:ml-auto", "lg:self-center");
  });
});
