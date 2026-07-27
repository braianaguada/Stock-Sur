import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicAppOrigin } from "./public-app-url";

describe("getPublicAppOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured public URL without trailing slashes", () => {
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://stock-sur.test///");

    expect(getPublicAppOrigin()).toBe("https://stock-sur.test");
  });

  it("falls back to the current browser origin", () => {
    vi.stubEnv("VITE_PUBLIC_APP_URL", "");

    expect(getPublicAppOrigin()).toBe(window.location.origin);
  });
});
