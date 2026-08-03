import {
  applyCompanyTheme,
  buildCompanyThemePayload,
  getThemePreviewState,
  inferThemePreset,
} from "./companyTheme";

describe("company theme", () => {
  it("preserves the selected secondary color in the saved payload and preview", () => {
    const payload = buildCompanyThemePayload("professional", "#2353a6", "#8b5cf6");
    const preview = getThemePreviewState("professional", payload.primary_color, payload.secondary_color);

    expect(payload.secondary_color).toBe("#8b5cf6");
    expect(preview.legacy.secondaryColor).toBe("#8b5cf6");
    expect(preview.tokens.secondary).toBe("258 90% 66%");
  });

  it("keeps dark mode identifiable when the secondary color is customized", () => {
    const payload = buildCompanyThemePayload("premium-dark", "#4f7cff", "#f59e0b");

    expect(inferThemePreset(payload)).toBe("premium-dark");
    applyCompanyTheme(payload);
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.dataset.uiTheme).toBe("premium-dark");
  });

  it("derives readable foregrounds for light configurable brand colors", () => {
    const preview = getThemePreviewState("professional", "#fef08a", "#fde68a");

    expect(preview.tokens["primary-foreground"]).toBe("0 0% 0%");
    expect(preview.tokens["secondary-foreground"]).toBe("0 0% 0%");
    expect(preview.tokens["sidebar-primary-foreground"]).toBe("0 0% 0%");
  });

  it("derives readable foregrounds for dark configurable brand colors", () => {
    const preview = getThemePreviewState("premium-dark", "#111827", "#172554");

    expect(preview.tokens["primary-foreground"]).toBe("0 0% 100%");
    expect(preview.tokens["secondary-foreground"]).toBe("0 0% 100%");
    expect(preview.tokens["sidebar-primary-foreground"]).toBe("0 0% 100%");
  });
});
