import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveUserCompanyAccess } from "@/features/users/mutations";
import type { UserAccessRow } from "@/features/users/types";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

const selectedUser: UserAccessRow = {
  user_id: "user-1",
  email: "user@test.local",
  full_name: "Test User",
  global_roles: [],
  companies: [],
};

describe("saveUserCompanyAccess", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("persists the complete access snapshot with one atomic RPC", async () => {
    rpcMock.mockResolvedValue({ data: "membership-1", error: null });

    await expect(
      saveUserCompanyAccess({
        selectedUser,
        accessForm: {
          companyUserId: "stale-client-membership-id",
          companyId: "company-1",
          roleId: "role-1",
          status: "ACTIVE",
        },
        permissionOverrides: {
          "permission-1": "ALLOW",
          "permission-2": "INHERIT",
          "permission-3": "DENY",
        },
        hasSelectedUser: true,
        hasCompany: true,
        hasRole: true,
      }),
    ).resolves.toBe("membership-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("save_user_company_access", {
      p_user_id: "user-1",
      p_company_id: "company-1",
      p_status: "ACTIVE",
      p_role_id: "role-1",
      p_permission_overrides: [
        { permission_id: "permission-1", effect: "ALLOW" },
        { permission_id: "permission-3", effect: "DENY" },
      ],
    });
  });

  it("surfaces the RPC failure without attempting fallback writes", async () => {
    const rpcError = new Error("atomic write rejected");
    rpcMock.mockResolvedValue({ data: null, error: rpcError });

    await expect(
      saveUserCompanyAccess({
        selectedUser,
        accessForm: {
          companyUserId: null,
          companyId: "company-1",
          roleId: "role-1",
          status: "INACTIVE",
        },
        permissionOverrides: {},
        hasSelectedUser: true,
        hasCompany: true,
        hasRole: true,
      }),
    ).rejects.toBe(rpcError);

    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
