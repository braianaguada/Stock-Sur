import { describe, expect, it } from "vitest";
import {
  buildExternalReferenceContextFromGeminiPayload,
  buildGroundedReferencePrompt,
  buildStructuredPromptWithExternalContext,
} from "../../../supabase/functions/service-quote-ai-assistant/grounding";
import {
  classifyAiFailure,
  shouldTryStructuredFallback,
} from "../../../supabase/functions/service-quote-ai-assistant/providerErrors";

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

  it("keeps prompts with line breaks and numbering safe for grounding", () => {
    const prompt = buildGroundedReferencePrompt([
      "Servicio tecnico Aire acondicionado.",
      "Revision e instalacion de aire A5 de turbina.",
      "2 Puesta en marcha y control de funcionamiento.",
    ].join("\n"));

    expect(prompt).toContain("Servicio tecnico Aire acondicionado.");
    expect(prompt).toContain("2 Puesta en marcha");
    expect(prompt).toContain("Google Search");
  });

  it("does not break when grounding metadata is incomplete", () => {
    const context = buildExternalReferenceContextFromGeminiPayload({
      attempted: true,
      failed: false,
      rawText: "",
      geminiPayload: { candidates: [{ groundingMetadata: {} }] },
    });

    expect(context.used).toBe(false);
    expect(context.webSearchQueries).toEqual([]);
    expect(context.sources).toEqual([]);
  });

  it("ignores sources without title or url", () => {
    const context = buildExternalReferenceContextFromGeminiPayload({
      attempted: true,
      failed: false,
      rawText: JSON.stringify({ summary: "Busqueda sin fuente util.", limitations: [] }),
      geminiPayload: {
        candidates: [{
          groundingMetadata: {
            webSearchQueries: ["service aire acondicionado"],
            groundingChunks: [{ web: { title: "", uri: "" } }],
          },
        }],
      },
    });

    expect(context.used).toBe(true);
    expect(context.sources).toEqual([]);
  });

  it("classifies provider quota and timeout as controlled errors without retrying quota fallback", () => {
    const quota = classifyAiFailure(new Error("Quota exceeded for generate_content_free_tier_requests. Please retry in 17.1s."));
    const timeout = classifyAiFailure(new Error("AbortError: The operation was aborted due to timeout"));

    expect(quota.status).toBe(429);
    expect(quota.code).toBe("AI_RATE_LIMITED");
    expect(quota.retryAfterSeconds).toBe(18);
    expect(shouldTryStructuredFallback(new Error("Quota exceeded"))).toBe(false);
    expect(timeout.status).toBe(504);
  });

  it("classifies empty or invalid Gemini content as a controlled response error", () => {
    const empty = classifyAiFailure(new Error("Gemini no devolvio contenido."));
    const schema = classifyAiFailure(new Error("La propuesta IA devolvio un rango de precio invalido."));

    expect(empty.status).toBe(422);
    expect(empty.code).toBe("AI_INVALID_RESPONSE");
    expect(schema.status).toBe(422);
    expect(shouldTryStructuredFallback(schema.logMessage)).toBe(true);
  });
});
