import { supabaseAuth, IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY } from "@/integrations/supabase/client";

type PdfProof =
  | { mode: "authenticated"; kind: "document" | "service"; documentId: string }
  | { mode: "public"; kind: "document" | "service"; token: string };

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
      abort?: () => Promise<void>;
    }>;
  }>;
};

export type PdfSaveTarget = {
  fileName: string;
  handle: Awaited<ReturnType<NonNullable<SaveFilePickerWindow["showSaveFilePicker"]>>> | null;
};

function normalizePdfFileName(fileName: string) {
  const base = fileName.replace(/\.pdf$/i, "").trim() || "documento";
  return `${base}.pdf`;
}

async function getAuthorizationHeader() {
  const impersonationToken = sessionStorage.getItem(IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY);
  if (impersonationToken) return `Bearer ${impersonationToken}`;
  const { data } = await supabaseAuth.getSession();
  return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function choosePdfSaveTarget(fileName: string): Promise<PdfSaveTarget> {
  const normalizedFileName = normalizePdfFileName(fileName);
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;
  const handle = picker
    ? await picker.call(window, {
        suggestedName: normalizedFileName,
        types: [{ description: "Documento PDF", accept: { "application/pdf": [".pdf"] } }],
      })
    : null;
  return { fileName: normalizedFileName, handle };
}

export async function savePrintHtmlAsPdf(params: {
  html: string;
  fileName: string;
  proof: PdfProof;
  target?: PdfSaveTarget;
}) {
  const target = params.target ?? await choosePdfSaveTarget(params.fileName);
  const { fileName, handle } = target;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (params.proof.mode === "authenticated") {
    const authorization = await getAuthorizationHeader();
    if (!authorization) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
    headers.authorization = authorization;
  }

  const response = await fetch("/api/render-pdf", {
    method: "POST",
    headers,
    body: JSON.stringify({ html: params.html, fileName, proof: params.proof }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "No se pudo generar el PDF.");
  }

  const blob = await response.blob();
  if (!handle) {
    downloadBlob(blob, fileName);
    return;
  }

  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort?.();
    throw error;
  }
}
