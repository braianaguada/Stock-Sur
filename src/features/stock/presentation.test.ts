import { describe, expect, it } from "vitest";
import { demandProfileBadge, getStockLevelBadge, movementTypeBadge, stockHealthBadge } from "./presentation";

describe("stock badge presentation", () => {
  it("uses the canonical semantic tones for stock health", () => {
    expect(stockHealthBadge.GREEN).toEqual({ label: "Operativo", tone: "success" });
    expect(stockHealthBadge.YELLOW.tone).toBe("warning");
    expect(stockHealthBadge.RED.tone).toBe("danger");
    expect(stockHealthBadge.GRAY.tone).toBe("muted");
  });

  it("keeps demand and movement labels centralized", () => {
    expect(demandProfileBadge.HIGH).toEqual({ label: "Rotación alta", tone: "info" });
    expect(movementTypeBadge.IN.tone).toBe("success");
    expect(movementTypeBadge.OUT.tone).toBe("info");
    expect(movementTypeBadge.ADJUSTMENT.tone).toBe("warning");
  });

  it("maps stock availability to stable labels and tones", () => {
    expect(getStockLevelBadge(undefined, "un")).toEqual({ label: "Stock no disponible", tone: "muted" });
    expect(getStockLevelBadge(0, "un")).toEqual({ label: "Sin stock", tone: "danger" });
    expect(getStockLevelBadge(3, "un")).toEqual({ label: "Stock bajo · 3", tone: "warning" });
    expect(getStockLevelBadge(12, "un")).toEqual({ label: "Disponible · 12", tone: "success" });
  });
});
