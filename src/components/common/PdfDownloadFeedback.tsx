import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PdfSaveResult } from "@/lib/pdf-download";

export function usePdfDownloadFeedback(companyId: string | null) {
  const [last, setLast] = useState<{ companyId: string | null; result: PdfSaveResult } | null>(null);
  const [url, setUrl] = useState("");
  useEffect(() => { setLast(null); }, [companyId]);
  const result = last?.companyId === companyId ? last.result : null;
  useEffect(() => {
    if (!result) { setUrl(""); return; }
    const next = URL.createObjectURL(result.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [result]);
  const feedback = result ? (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
      <Download className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1"><p className="break-all font-medium">{result.fileName}</p><p className="text-xs text-muted-foreground">{result.method === "saved" ? "Guardado en la ubicacion que elegiste." : "Descarga iniciada. Buscala en las descargas del navegador. Para elegir carpeta, activa la opcion Preguntar donde guardar en su configuracion."}</p></div>
      {url ? <Button variant="outline" size="sm" asChild><a href={url} download={result.fileName}>Descargar otra vez</a></Button> : null}
      <Button variant="ghost" size="icon" aria-label="Cerrar aviso de descarga" onClick={() => setLast(null)}><X className="h-4 w-4" /></Button>
    </div>
  ) : null;
  return { feedback, onSaved: (result: PdfSaveResult | undefined) => { if (result) setLast({ companyId, result }); } };
}
