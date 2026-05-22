import { describe, expect, it } from "vitest";
import { hasTechnicianHistory, TECHNICIAN_DELETE_BLOCKED_MESSAGE } from "./technicianLifecycle";

describe("technician lifecycle", () => {
  it("allows physical deletion only when the technician has no operational history", () => {
    expect(hasTechnicianHistory({ documents: 0, serviceAssignments: 0 })).toBe(false);
    expect(hasTechnicianHistory({ documents: 1, serviceAssignments: 0 })).toBe(true);
    expect(hasTechnicianHistory({ documents: 0, serviceAssignments: 1 })).toBe(true);
  });

  it("uses an inactive-state message instead of financial account language", () => {
    expect(TECHNICIAN_DELETE_BLOCKED_MESSAGE).toContain("Inactivo");
    expect(TECHNICIAN_DELETE_BLOCKED_MESSAGE.toLowerCase()).not.toContain("cuenta corriente");
    expect(TECHNICIAN_DELETE_BLOCKED_MESSAGE.toLowerCase()).not.toContain("deuda");
  });
});
