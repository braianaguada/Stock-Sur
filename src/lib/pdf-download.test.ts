import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY: "stock-sur-impersonation-access-token",
  supabaseAuth: { getSession: getSessionMock },
}));

import { choosePdfSaveTarget, savePrintHtmlAsPdf } from "./pdf-download";

describe("PDF download", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    getSessionMock.mockReset();
  });

  it("opens the native save picker and writes the generated PDF to the selected file", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = { createWritable: vi.fn().mockResolvedValue({ write, close }) };
    const picker = vi.fn().mockResolvedValue(handle);
    (window as Window & { showSaveFilePicker?: typeof picker }).showSaveFilePicker = picker;
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["pdf"], { type: "application/pdf" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const target = await choosePdfSaveTarget("Presupuesto 12");
    await savePrintHtmlAsPdf({
      html: "<html><body>Documento</body></html>",
      fileName: "Presupuesto 12",
      proof: { mode: "public", kind: "service", token: "token-publico-valido-123456" },
      target,
    });

    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: "Presupuesto 12.pdf" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/render-pdf", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"mode":"public"'),
    }));
    expect(write).toHaveBeenCalledWith(expect.any(Blob));
    expect(close).toHaveBeenCalled();
  });

  it("sends the active session when the document is private", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "access-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["pdf"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pdf");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await savePrintHtmlAsPdf({
      html: "<html><body>Documento</body></html>",
      fileName: "documento.pdf",
      proof: { mode: "authenticated", kind: "service", documentId: "document-1" },
      target: { fileName: "documento.pdf", handle: null },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/render-pdf", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer access-token" }),
    }));
  });
});
