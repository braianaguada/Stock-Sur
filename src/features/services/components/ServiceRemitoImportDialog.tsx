import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/errors";
import { loadTesseract } from "@/lib/lazy-vendors";
import { parseServiceRemitoText, type ServiceRemitoImport } from "../remitoOcr";

export function ServiceRemitoImportDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; onImport: (draft: ServiceRemitoImport) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scan = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Seleccioná una imagen JPG, PNG o WEBP del remito.");
    setLoading(true);
    setError("");
    try {
      const { createWorker } = await loadTesseract();
      const worker = await createWorker("spa+eng");
      try {
        const result = await worker.recognize(file);
        const draft = parseServiceRemitoText(result.data.text);
        if (!draft.lines.length) throw new Error("No se reconocieron trabajos legibles en el remito.");
        props.onImport(draft);
        props.onOpenChange(false);
      } finally {
        await worker.terminate();
      }
    } catch (caught) {
      setError(`${getErrorMessage(caught)} Probá con una foto de frente, nítida y con buena luz.`);
    } finally {
      setLoading(false);
    }
  };

  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Importar remito</DialogTitle><DialogDescription>Transcribe número, fecha, trabajos y precios reconocibles. Luego podrás corregir el borrador antes de guardarlo.</DialogDescription></DialogHeader>
      <label className="grid min-h-40 cursor-pointer place-items-center rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center hover:bg-primary/10">
        <span>{loading ? <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" /> : <Camera className="mx-auto mb-3 h-7 w-7" />}<b className="block">{loading ? "Leyendo remito..." : "Tomar foto o subir imagen"}</b><small className="mt-2 block text-muted-foreground">JPG, PNG o WEBP. Los fragmentos dudosos no se copiarán.</small></span>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={loading} onChange={(event) => { void scan(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </label>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </DialogContent>
  </Dialog>;
}
