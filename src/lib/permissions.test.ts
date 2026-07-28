import { describe, expect, it } from "vitest";
import {
  canCancelSettlements,
  canReceiveSettlements,
  canSubmitSettlements,
  canViewSettlements,
} from "@/lib/permissions";

describe("settlement permissions", () => {
  it("requires effective company permissions even for global superadmins", () => {
    const context = {
      companyPermissionCodes: ["settlements.view", "settlements.submit"],
    };

    expect(canViewSettlements(["superadmin"], context)).toBe(true);
    expect(canSubmitSettlements(["superadmin"], context)).toBe(true);
    expect(canReceiveSettlements(["superadmin"], context)).toBe(false);
    expect(canCancelSettlements(["superadmin"], context)).toBe(false);
  });

  it("does not let legacy global admin bypass company permissions", () => {
    const context = { companyPermissionCodes: ["settlements.view"] };

    expect(canViewSettlements(["admin"], context)).toBe(true);
    expect(canReceiveSettlements(["admin"], context)).toBe(false);
  });

  it("allows company admins through effective inherited permissions", () => {
    const context = {
      companyRoleCodes: ["admin"],
      companyPermissionCodes: ["settlements.view", "settlements.submit"],
    };

    expect(canViewSettlements(["user"], context)).toBe(true);
    expect(canSubmitSettlements(["user"], context)).toBe(true);
  });

  it("honors denied company permissions even when the raw company role is admin", () => {
    const context = {
      companyRoleCodes: ["admin"],
      companyPermissionCodes: ["settlements.view", "settlements.submit", "settlements.cancel"],
    };

    expect(canViewSettlements(["user"], context)).toBe(true);
    expect(canSubmitSettlements(["user"], context)).toBe(true);
    expect(canReceiveSettlements(["user"], context)).toBe(false);
  });

  it("requires the matching granular permission for regular users", () => {
    const context = { companyPermissionCodes: ["settlements.view", "settlements.receive"] };

    expect(canViewSettlements(["user"], context)).toBe(true);
    expect(canReceiveSettlements(["user"], context)).toBe(true);
    expect(canSubmitSettlements(["user"], context)).toBe(false);
    expect(canCancelSettlements(["user"], context)).toBe(false);
  });
});
