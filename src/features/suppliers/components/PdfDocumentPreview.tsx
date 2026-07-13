import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPdfJs } from "@/lib/lazy-vendors";

type PdfJsModule = Awaited<ReturnType<typeof loadPdfJs>>;
type PdfLoadingTask = ReturnType<PdfJsModule["getDocument"]>;
type PdfDocument = Awaited<PdfLoadingTask["promise"]>;

interface PdfDocumentPreviewProps {
  file: File;
}

export function PdfDocumentPreview({ file }: PdfDocumentPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let loadingTask: PdfLoadingTask | null = null;
    setIsLoading(true);
    setError(null);
    setDocument(null);
    setPageNumber(1);
    setZoom(1);

    void (async () => {
      try {
        const { getDocument } = await loadPdfJs();
        loadingTask = getDocument({ data: await file.arrayBuffer() });
        const loadedDocument = await loadingTask.promise;
        if (!active) {
          await loadedDocument.destroy();
          return;
        }
        setDocument(loadedDocument);
      } catch {
        if (active) setError("No se pudo mostrar la vista previa del PDF.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
      void loadingTask?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!document || !canvasRef.current) return;
    let active = true;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (!active || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
      } catch (renderError) {
        if (active && !(renderError instanceof Error && renderError.name === "RenderingCancelledException")) {
          setError("No se pudo renderizar esta página.");
        }
      }
    })();

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [document, pageNumber, zoom]);

  return (
    <section className="overflow-hidden rounded-xl border bg-muted/30" aria-label="Vista previa del PDF">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Página anterior"
            disabled={!document || pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-24 text-center text-xs font-medium">
            Página {pageNumber} / {document?.numPages ?? "-"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Página siguiente"
            disabled={!document || pageNumber >= document.numPages}
            onClick={() => setPageNumber((current) => Math.min(document?.numPages ?? current, current + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Alejar" disabled={zoom <= 0.6} onClick={() => setZoom((current) => Math.max(0.6, current - 0.2))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Acercar" disabled={zoom >= 2} onClick={() => setZoom((current) => Math.min(2, current + 0.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex h-[58vh] min-h-80 items-start justify-center overflow-auto p-3">
        {isLoading ? <Loader2 className="mt-12 h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando PDF" /> : null}
        {error ? <p className="mt-12 px-4 text-center text-sm text-destructive">{error}</p> : null}
        <canvas ref={canvasRef} className={isLoading || error ? "hidden" : "bg-white shadow-sm"} />
      </div>
    </section>
  );
}
