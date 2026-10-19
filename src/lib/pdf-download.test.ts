import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  IMPERSONATION_ACCESS_TOKEN_STORAGE_KEY: "stock-sur-impersonation-access-token",
  supabaseAuth: { auth: { getSession: getSessionMock } },
}));

import { choosePdfSaveTarget, savePrintHtmlAsPdf } from "./pdf-download";

describe("PDF download", () => {
  it("opens the save picker with the PDF filename before doing any generation", async () => {
    const handle = { createWritable: vi.fn() };
    const picker = vi.fn().mockResolvedValue(handle);
    (window as Window & { showSaveFilePicker?: typeof picker }).showSaveFilePicker = picker;
    const target = choosePdfSaveTarget("remito");
    expect(picker).toHaveBeenCalledWith({
      suggestedName: "remito.pdf",
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    await expect(target).resolves.toEqual({ fileName: "remito.pdf", handle });
  });

  it("keeps browser downloads available when the save picker is unsupported", async () => {
    await expect(choosePdfSaveTarget("remito.PDF")).resolves.toEqual({ fileName: "remito.pdf", handle: null });
  });

  it.each(["AbortError", "NotAllowedError"])("does not generate or download after picker %s", async (name) => {
    const error = new DOMException("Save picker closed or denied", name);
    const picker = vi.fn().mockRejectedValue(error);
    (window as Window & { showSaveFilePicker?: typeof picker }).showSaveFilePicker = picker;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await expect(savePrintHtmlAsPdf({
      html: "<html>Documento</html>",
      fileName: "remito",
      proof: { mode: "public", kind: "document", token: "token-publico-valido-123456" },
    })).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

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
    const fetchMock = vi.fn().mockResolvedValue(new Response("pdf", {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await savePrintHtmlAsPdf({
      html: "<html><body>Documento</body></html>",
      fileName: "Presupuesto 12",
      proof: { mode: "public", kind: "service", token: "token-publico-valido-123456" },
    });

    expect(picker).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/render-pdf", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"mode":"public"'),
    }));
    const writtenFile = write.mock.calls[0]?.[0] as Blob;
    expect(writtenFile).toEqual(expect.objectContaining({
      size: 3,
      type: "application/pdf",
    }));
    expect(close).toHaveBeenCalled();
  });

  it("sends the active session when the document is private", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "access-token" } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["pdf"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pdf");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("documento.pdf");
      expect(this.href).toBe("blob:pdf");
      expect(this.isConnected).toBe(true);
    });

    const result = await savePrintHtmlAsPdf({
      html: "<html><body>Documento</body></html>",
      fileName: "documento.pdf",
      proof: { mode: "authenticated", kind: "service", documentId: "document-1" },
      target: { fileName: "documento.pdf", handle: null },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/render-pdf", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer access-token" }),
    }));
    expect(getSessionMock).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ fileName: "documento.pdf", method: "downloaded" });
    expect(document.querySelector("a[download] ")).toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
