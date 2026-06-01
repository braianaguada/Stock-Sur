import { describe, expect, it } from "vitest";
import {
  buildExternalReferenceContextFromGeminiPayload,
  buildStructuredPromptWithExternalContext,
} from "../../../supabase/functions/service-quote-ai-assistant/grounding";

describe("service quote AI grounding traceability", () => {
  it("marks external references as used when Gemini returns search metadata", () => {
    const context = buildExternalReferenceContextFromGeminiPayload({
      attempted: true,
      failed: false,
      rawText: JSON.stringify({
        summary: "Referencias orientativas de service y repuestos.",
        limitations: ["Confirmar modelo exacto."],
      }),
      now: new Date("2026-06-01T12:00:00.000Z"),
      geminiPayload: {
        candidates: [{
          groundingMetadata: {
            webSearchQueries: ["motocompresor heladera comercial precio Argentina"],
            groundingChunks: [{
              web: {
                title: "Referencia de repuestos",
                uri: "https://example.test/repuestos",
              },
            }],
          },
        }],
      },
    });

    expect(context.used).toBe(true);
    expect(context.webSearchQueries).toEqual(["motocompresor heladera comercial precio Argentina"]);
    expect(context.sources).toEqual([{ title: "Referencia de repuestos", uri: "https://example.test/repuestos" }]);
    expect(context.summary).toContain("Referencias orientativas");
    expect(context.fetchedAt).toBe("2026-06-01T12:00:00.000Z");
  });

  it("records fallback without external sources when grounding fails", () => {
    const context = buildExternalReferenceContextFromGeminiPayload({
      attempted: true,
      failed: true,
      failureReason: "response schema with tool rejected",
      geminiPayload: {},
    });

    expect(context.used).toBe(false);
    expect(context.failed).toBe(true);
    expect(context.limitations).toContain("No se pudieron usar referencias externas en esta propuesta.");
    expect(context.failureReason).toContain("response schema");
  });

  it("keeps structured pass context minimal and strips HTML from stored metadata", () => {
    const context = buildExternalReferenceContextFromGeminiPayload({
      attempted: true,
      failed: false,
      rawText: JSON.stringify({
        summary: "<html><body>Rango orientativo <strong>sin precio exacto</strong></body></html>",
        limitations: ["<script>alert('x')</script>Sin modelo confirmado"],
      }),
      geminiPayload: {
        candidates: [{
          groundingMetadata: {
            webSearchQueries: ["<b>aire acondicionado split service</b>"],
            groundingChunks: [{
              web: {
                title: "<div>Service split</div>",
                uri: "https://example.test/service",
              },
            }],
          },
        }],
      },
    });
    const prompt = buildStructuredPromptWithExternalContext("Prompt base", context);

    expect(context.summary).toBe("Rango orientativo sin precio exacto");
    expect(context.limitations[0]).toBe("Sin modelo confirmado");
    expect(context.webSearchQueries[0]).toBe("aire acondicionado split service");
    expect(context.sources[0].title).toBe("Service split");
    expect(prompt).not.toMatch(/<html|<body|<script|<div|<b/i);
    expect(prompt).toContain("\"externalReferencesUsed\":true");
  });
});
