import { afterEach, describe, expect, it, vi } from "vitest";
import { enhanceRemitoImage, resolveServiceRemitoFileType } from "./remitoImage";

const { loadPdfJsMock } = vi.hoisted(() => ({ loadPdfJsMock: vi.fn() }));

vi.mock("@/lib/lazy-vendors", () => ({ loadPdfJs: loadPdfJsMock }));

afterEach(() => {
  loadPdfJsMock.mockReset();
  vi.restoreAllMocks();
});

describe("resolveServiceRemitoFileType", () => {
  it("accepts a PDF reported by the browser", () => {
    expect(resolveServiceRemitoFileType({ name: "12661 - 1115.pdf", type: "application/pdf" })).toBe("application/pdf");
  });

  it("infers PDF from its extension when Windows omits the MIME type", () => {
    expect(resolveServiceRemitoFileType({ name: "12661 - 1115.PDF", type: "" })).toBe("application/pdf");
  });

  it("rejects unsupported files", () => {
    expect(resolveServiceRemitoFileType({ name: "remito.docx", type: "application/octet-stream" })).toBeNull();
  });

  it("renders and enhances the first PDF page as a visual extraction source", async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const destroy = vi.fn(() => Promise.resolve());
    loadPdfJsMock.mockResolvedValue({
      getDocument: () => ({
        promise: Promise.resolve({
          getPage: vi.fn(() => Promise.resolve({
            getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
            render,
          })),
          destroy,
        }),
      }),
    });
    const context = {
      fillStyle: "",
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([20, 20, 20, 255, 240, 240, 240, 255]) })),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,pdf-preview");

    const file = {
      name: "remito.PDF",
      type: "",
      arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
    } as unknown as File;
    const result = await enhanceRemitoImage(file);

    expect(result).toBe("pdf-preview");
    expect(render).toHaveBeenCalledOnce();
    expect(context.fillRect).toHaveBeenCalledOnce();
    expect(context.putImageData).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
