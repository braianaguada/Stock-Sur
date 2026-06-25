import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const MAX_HTML_BYTES = 1_500_000;
const DOCUMENT_TABLES = {
  document: "documents",
  service: "service_documents",
} as const;
const PUBLIC_PAYLOAD_FUNCTIONS = {
  document: "get_public_document_payload",
  service: "get_public_service_document_payload",
} as const;

type DocumentKind = keyof typeof DOCUMENT_TABLES;
type RenderProof =
  | { mode: "authenticated"; kind: DocumentKind; documentId: string }
  | { mode: "public"; kind: DocumentKind; token: string };

type RenderPdfBody = {
  html?: unknown;
  fileName?: unknown;
  proof?: unknown;
};

type PdfRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

type PdfResponse = {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => PdfResponse;
  json: (payload: unknown) => PdfResponse;
  send: (payload: Buffer) => PdfResponse;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error("Supabase no está configurado para generar PDFs.");
  return { url: url.replace(/\/$/, ""), anonKey };
}

function isDocumentKind(value: unknown): value is DocumentKind {
  return value === "document" || value === "service";
}

function parseProof(value: unknown): RenderProof | null {
  if (!value || typeof value !== "object") return null;
  const proof = value as Record<string, unknown>;
  if (!isDocumentKind(proof.kind)) return null;
  if (proof.mode === "authenticated" && typeof proof.documentId === "string" && proof.documentId.length > 0) {
    return { mode: "authenticated", kind: proof.kind, documentId: proof.documentId };
  }
  if (proof.mode === "public" && typeof proof.token === "string" && proof.token.length >= 20) {
    return { mode: "public", kind: proof.kind, token: proof.token };
  }
  return null;
}

async function validateAuthenticatedProof(proof: Extract<RenderProof, { mode: "authenticated" }>, authorization: string) {
  const { url, anonKey } = getSupabaseConfig();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization },
  });
  if (!userResponse.ok) return false;

  const table = DOCUMENT_TABLES[proof.kind];
  const documentResponse = await fetch(
    `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(proof.documentId)}&select=id&limit=1`,
    { headers: { apikey: anonKey, authorization } },
  );
  if (!documentResponse.ok) return false;
  const rows = await documentResponse.json() as Array<{ id: string }>;
  return rows.some((row) => row.id === proof.documentId);
}

async function validatePublicProof(proof: Extract<RenderProof, { mode: "public" }>) {
  const { url, anonKey } = getSupabaseConfig();
  const functionName = PUBLIC_PAYLOAD_FUNCTIONS[proof.kind];
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_token: proof.token }),
  });
  if (!response.ok) return false;
  const payload = await response.json() as { status?: string };
  return payload.status === "ok";
}

export function sanitizeHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

export function sanitizeFileName(value: string) {
  const withoutControlCharacters = Array.from(value, (character) => character.charCodeAt(0) < 32 ? "-" : character).join("");
  const cleaned = withoutControlCharacters.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim();
  const base = cleaned.replace(/\.pdf$/i, "") || "documento";
  return `${base.slice(0, 120)}.pdf`;
}

export default async function handler(request: PdfRequest, response: PdfResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const body = request.body as RenderPdfBody | undefined;
  const html = typeof body?.html === "string" ? body.html : "";
  const proof = parseProof(body?.proof);
  if (!html || !proof || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return response.status(400).json({ error: "Solicitud de PDF inválida." });
  }

  const authorizationHeader = request.headers.authorization;
  const authorization = Array.isArray(authorizationHeader)
    ? authorizationHeader[0] ?? ""
    : authorizationHeader ?? "";
  const authorized = proof.mode === "authenticated"
    ? authorization.startsWith("Bearer ") && await validateAuthenticatedProof(proof, authorization)
    : await validatePublicProof(proof);
  if (!authorized) {
    return response.status(403).json({ error: "No tenés permiso para generar este PDF." });
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (resourceRequest) => {
      const resourceUrl = resourceRequest.url();
      if (resourceRequest.isNavigationRequest() || resourceUrl.startsWith("data:") || resourceUrl.startsWith("https://")) {
        void resourceRequest.continue();
      } else {
        void resourceRequest.abort();
      }
    });
    const host = request.headers["x-forwarded-host"] ?? request.headers.host;
    const forwardedProtocol = request.headers["x-forwarded-proto"];
    const protocol = Array.isArray(forwardedProtocol) ? forwardedProtocol[0] : forwardedProtocol ?? "https";
    const baseTag = host ? `<base href="${protocol}://${Array.isArray(host) ? host[0] : host}/" />` : "";
    const renderHtml = sanitizeHtml(html).replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    await page.setContent(renderHtml, { waitUntil: "load", timeout: 20_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);
    await page.evaluate(async () => {
      const imagesReady = Promise.all(Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })));
      await Promise.race([
        imagesReady,
        new Promise<void>((resolve) => window.setTimeout(resolve, 3_000)),
      ]);
    });
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const fileName = sanitizeFileName(typeof body?.fileName === "string" ? body.fileName : "documento.pdf");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).send(Buffer.from(pdf));
  } catch (error) {
    console.error("PDF render failed", error instanceof Error ? error.message : "unknown error");
    return response.status(500).json({ error: "No se pudo generar el PDF." });
  } finally {
    await browser?.close();
  }
}
