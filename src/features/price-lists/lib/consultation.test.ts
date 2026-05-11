import { describe, expect, it } from "vitest";
import { getApproxMarginPct, getPriceConsultationState } from "./consultation";

describe("price consultation helpers", () => {
  it("keeps price state labels visual and explicit", () => {
    expect(getPriceConsultationState({ base_cost: 0, has_price: false, needs_recalculation: false }).label).toBe("Sin costo base");
    expect(getPriceConsultationState({ base_cost: 100, has_price: false, needs_recalculation: false }).label).toBe("Sin precio en lista");
    expect(getPriceConsultationState({ base_cost: 100, has_price: true, needs_recalculation: true }).label).toBe("Recalcular");
    expect(getPriceConsultationState({ base_cost: 100, has_price: true, needs_recalculation: false }).label).toBe("Precio vigente");
  });

  it("calculates approximate margin without changing operational price logic", () => {
    expect(getApproxMarginPct(80, 100)).toBe(20);
    expect(getApproxMarginPct(80, 0)).toBeNull();
    expect(getApproxMarginPct(80, null)).toBeNull();
  });
});
