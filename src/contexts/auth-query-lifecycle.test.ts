import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  EffectiveIdentityTracker,
  RequestGeneration,
  getEffectiveIdentityKey,
  retireCompanyCache,
  retireIdentityCache,
} from "@/contexts/auth-query-lifecycle";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

describe("effective identity query lifecycle", () => {
  it("distinguishes login, impersonation and restored actor identities", () => {
    const actor = getEffectiveIdentityKey({
      actorUserId: "actor-1",
      effectiveUserId: "actor-1",
      impersonationId: null,
    });
    const impersonated = getEffectiveIdentityKey({
      actorUserId: "actor-1",
      effectiveUserId: "user-2",
      impersonationId: "impersonation-1",
    });

    expect(actor).not.toBe(impersonated);
    expect(impersonated).not.toBe(getEffectiveIdentityKey({
      actorUserId: "actor-1",
      effectiveUserId: "user-2",
      impersonationId: "impersonation-2",
    }));
  });

  it("claims each identity once so rerenders do not create a cleanup loop", () => {
    const tracker = new EffectiveIdentityTracker();

    expect(tracker.claim("actor-1:actor-1:self")).toBe(true);
    expect(tracker.claim("actor-1:actor-1:self")).toBe(false);
    expect(tracker.claim("actor-1:user-2:impersonation-1")).toBe(true);
    expect(tracker.claim("actor-1:user-2:impersonation-1")).toBe(false);
    expect(tracker.claim("actor-1:actor-1:self")).toBe(true);
  });

  it.each([
    {
      transition: "logout and login with another user",
      identities: ["actor-1:actor-1:self", "anonymous:anonymous:self", "actor-2:actor-2:self"],
    },
    {
      transition: "start impersonation",
      identities: ["actor-1:actor-1:self", "actor-1:user-2:impersonation-1"],
    },
    {
      transition: "stop impersonation",
      identities: ["actor-1:user-2:impersonation-1", "actor-1:actor-1:self"],
    },
    {
      transition: "restore a session",
      identities: ["anonymous:anonymous:self", "actor-1:actor-1:self"],
    },
  ])("retires old cache during $transition", async ({ identities }) => {
    const tracker = new EffectiveIdentityTracker();
    const queryClient = createTestQueryClient();

    for (const [index, identity] of identities.entries()) {
      queryClient.setQueryData(["permissions", `identity-${index - 1}`], ["stale"]);
      if (tracker.claim(identity)) {
        await retireIdentityCache(queryClient);
      }
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    }
  });

  it("invalidates late auth and permission results after an identity transition", () => {
    const authRequests = new RequestGeneration();
    const permissionRequests = new RequestGeneration();
    const oldAuthRequest = authRequests.next();
    const oldPermissionRequest = permissionRequests.next();

    authRequests.invalidate();
    permissionRequests.invalidate();

    expect(authRequests.isCurrent(oldAuthRequest)).toBe(false);
    expect(permissionRequests.isCurrent(oldPermissionRequest)).toBe(false);
    expect(authRequests.isCurrent(authRequests.next())).toBe(true);
    expect(permissionRequests.isCurrent(permissionRequests.next())).toBe(true);
  });

  it("cancels pending requests and clears every cached permission on identity change", async () => {
    const queryClient = createTestQueryClient();
    const aborted = vi.fn();
    const pending = queryClient.fetchQuery({
      queryKey: ["permissions", "company-1", "user-1"],
      queryFn: ({ signal }) => new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted();
          reject(new Error("aborted"));
        });
      }),
    });
    queryClient.setQueryData(["profile", "user-1"], { email: "old@example.com" });

    const pendingExpectation = expect(pending).rejects.toThrow();
    await retireIdentityCache(queryClient);
    await pendingExpectation;
    expect(aborted).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("does not let a non-cooperative late response repopulate the abandoned identity cache", async () => {
    const queryClient = createTestQueryClient();
    let resolveRequest!: (value: string) => void;
    const pending = queryClient.fetchQuery({
      queryKey: ["documents", "company-1"],
      queryFn: () => new Promise<string>((resolve) => {
        resolveRequest = resolve;
      }),
    });

    await retireIdentityCache(queryClient);
    resolveRequest("late-old-user-data");
    await pending.catch(() => undefined);

    expect(queryClient.getQueryData(["documents", "company-1"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("removes only the previous company scope during an ordinary company switch", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["items", "company-1"], ["old"]);
    queryClient.setQueryData(["items", "company-2"], ["next"]);
    queryClient.setQueryData(["public-catalog"], ["shared"]);
    queryClient.setQueryData(["report", { companyId: "company-1" }], ["old-object-key"]);

    await retireCompanyCache(queryClient, "company-1");

    expect(queryClient.getQueryData(["items", "company-1"])).toBeUndefined();
    expect(queryClient.getQueryData(["report", { companyId: "company-1" }])).toBeUndefined();
    expect(queryClient.getQueryData(["items", "company-2"])).toEqual(["next"]);
    expect(queryClient.getQueryData(["public-catalog"])).toEqual(["shared"]);
  });
});
