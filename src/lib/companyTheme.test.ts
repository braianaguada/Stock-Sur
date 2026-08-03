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
});
