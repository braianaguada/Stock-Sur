import { describe, expect, it } from "vitest";
import {
  canCancelSettlements,
  canCreateSettlements,
  canEditSettlements,
  canReceiveSettlements,
  canSubmitSettlements,
  canViewSettlements,
} from "@/lib/permissions";

describe("settlement permissions", () => {
  it("allows global admins to use settlement actions", () => {
    expect(canViewSettlements(["admin"])).toBe(true);
    expect(canCreateSettlements(["admin"])).toBe(true);
    expect(canEditSettlements(["admin"])).toBe(true);
    expect(canSubmitSettlements(["admin"])).toBe(true);
    expect(canReceiveSettlements(["admin"])).toBe(true);
    expect(canCancelSettlements(["admin"])).toBe(true);
  });

  it("allows company admins through the company role context", () => {
    const context = { companyRoleCodes: ["admin"], companyPermissionCodes: [] };

    expect(canViewSettlements(["user"], context)).toBe(true);
    expect(canSubmitSettlements(["user"], context)).toBe(true);
  });

  it("requires the matching granular permission for regular users", () => {
    const context = { companyPermissionCodes: ["settlements.view", "settlements.receive"] };

    expect(canViewSettlements(["user"], context)).toBe(true);
    expect(canReceiveSettlements(["user"], context)).toBe(true);
    expect(canSubmitSettlements(["user"], context)).toBe(false);
    expect(canCancelSettlements(["user"], context)).toBe(false);
  });
});
