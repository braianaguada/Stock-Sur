import { beforeEach, describe, expect, it } from "vitest";
import { resolveCurrentCompanyId } from "@/contexts/auth-access-state";
import {
  clearLegacyCurrentCompanyId,
  clearPersistedCurrentCompanyId,
  CURRENT_COMPANY_STORAGE_KEY,
  getCurrentCompanyStorageKey,
  persistCurrentCompanyId,
} from "@/contexts/auth-session-effects";

const companies = [
  { id: "company-1" },
  { id: "company-2" },
];

describe("active company selection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores a valid remembered company", () => {
    expect(resolveCurrentCompanyId({ companies, storedCompanyId: "company-2" })).toEqual({
      currentCompanyId: "company-2",
      shouldClearStoredCompanyId: false,
    });
  });

  it("clears an invalid remembered company and falls back to the first active company", () => {
    expect(resolveCurrentCompanyId({ companies, storedCompanyId: "revoked-company" })).toEqual({
      currentCompanyId: "company-1",
      shouldClearStoredCompanyId: true,
    });
  });

  it("returns a blocking null company when there are no available companies", () => {
    expect(resolveCurrentCompanyId({ companies: [], storedCompanyId: "company-1" })).toEqual({
      currentCompanyId: null,
      shouldClearStoredCompanyId: true,
    });
  });

  it("stores remembered company per user and avoids browser cross-user sharing", () => {
    persistCurrentCompanyId("user-1", "company-1");
    persistCurrentCompanyId("user-2", "company-2");

    expect(localStorage.getItem(getCurrentCompanyStorageKey("user-1"))).toBe("company-1");
    expect(localStorage.getItem(getCurrentCompanyStorageKey("user-2"))).toBe("company-2");
    expect(localStorage.getItem(CURRENT_COMPANY_STORAGE_KEY)).toBeNull();
  });

  it("removes only the selected user's remembered company and can clear the legacy key", () => {
    localStorage.setItem(CURRENT_COMPANY_STORAGE_KEY, "legacy-company");
    persistCurrentCompanyId("user-1", "company-1");
    persistCurrentCompanyId("user-2", "company-2");

    clearPersistedCurrentCompanyId("user-1");
    clearLegacyCurrentCompanyId();

    expect(localStorage.getItem(getCurrentCompanyStorageKey("user-1"))).toBeNull();
    expect(localStorage.getItem(getCurrentCompanyStorageKey("user-2"))).toBe("company-2");
    expect(localStorage.getItem(CURRENT_COMPANY_STORAGE_KEY)).toBeNull();
  });
});
