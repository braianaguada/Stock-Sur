import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { parseStructuredServiceRemito, type ServiceRemitoImport } from "../remitoOcr";
import { enhanceRemitoImage, isRetryableFunctionError, readFunctionError } from "../remitoImage";

export function ServiceRemitoImportDialog(props: { companyId: string | null; open: boolean; onOpenChange: (open: boolean) => void; onImport: (draft: ServiceRemitoImport) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scan = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Seleccioná una imagen JPG, PNG o WEBP del remito.");
    if (!props.companyId) return setError("Seleccioná una empresa antes de importar el remito.");
    if (file.size > 8 * 1024 * 1024) return setError("La imagen supera el máximo de 8 MB.");
    setLoading(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const enhancedImageBase64 = await enhanceRemitoImage(file).catch(() => null);
      const imageBase64 = btoa(binary);
      let draft: ServiceRemitoImport | null = null;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data, error: invokeError } = await supabase.functions.invoke("service-remito-extractor", {
          body: { companyId: props.companyId, mimeType: file.type, imageBase64, enhancedImageBase64 },
        });
        if (invokeError) {
          lastError = new Error(await readFunctionError(invokeError));
          if (attempt === 0 && isRetryableFunctionError(invokeError)) continue;
          throw lastError;
        }
        if (data?.error) throw new Error(data.error);
        const parsed = parseStructuredServiceRemito(data?.extraction);
        if (parsed.lines.length) {
          draft = parsed;
          break;
        }
        lastError = new Error("No se reconocieron trabajos legibles en el remito.");
      }
      if (!draft) throw lastError ?? new Error("No se pudo interpretar el remito.");
      props.onImport(draft);
      props.onOpenChange(false);
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
        <span>{loading ? <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" /> : <Camera className="mx-auto mb-3 h-7 w-7" />}<b className="block">{loading ? "Interpretando remito..." : "Tomar foto o subir imagen"}</b><small className="mt-2 block text-muted-foreground">JPG, PNG o WEBP, hasta 8 MB. Los fragmentos dudosos no se copiarán.</small></span>
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={loading} onChange={(event) => { void scan(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      </label>
      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </DialogContent>
  </Dialog>;
}
