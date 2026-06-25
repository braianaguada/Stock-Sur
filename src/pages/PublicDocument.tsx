import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { usePublicDocument } from "@/features/documents/hooks/usePublicDocument";
import { buildDocumentPrintHtml } from "@/features/documents/print";
import { formatNumber } from "@/features/documents/utils";
import { savePrintHtmlAsPdf } from "@/lib/pdf-download";

export default function PublicDocumentPage() {
  const { token } = useParams();
  const query = usePublicDocument(token ?? null);
  const payload = query.data;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  if (query.isLoading) return <PublicMessage title="Cargando documento..." />;
  if (!payload || payload.status === "not_found") return <PublicMessage title="Documento no encontrado" />;
  if (payload.status === "revoked") return <PublicMessage title="Este documento ya no está disponible" />;
  if (payload.status === "expired") return <PublicMessage title="Este link expiró" />;

  const html = buildDocumentPrintHtml({
    document: payload.document,
    lines: payload.lines,
    technicianName: payload.technician_name,
    companySettings: { ...DEFAULT_COMPANY_SETTINGS, ...payload.company },
  });
  const label = payload.document.doc_type === "PRESUPUESTO" ? "Presupuesto" : "Remito";
  const documentNumber = formatNumber(payload.document.document_number, payload.document.point_of_sale);
  const savePdf = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await savePrintHtmlAsPdf({
        html,
        fileName: `${label}-${documentNumber}.pdf`,
        proof: { mode: "public", kind: "document", token: token ?? "" },
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setSaveError(error instanceof Error ? error.message : "No se pudo guardar el PDF.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-200">
      <div className="sticky top-0 z-20 border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-950">{label} {documentNumber}</p>
          <Button onClick={() => void savePdf()} disabled={isSaving}>
            <Download className="mr-2 h-4 w-4" /> {isSaving ? "Generando..." : "Guardar PDF"}
          </Button>
        </div>
        {saveError && <p className="mx-auto mt-2 max-w-5xl text-sm text-red-700">{saveError}</p>}
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}

function PublicMessage({ title }: { title: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><h1 className="rounded-xl border bg-white px-6 py-5 text-lg font-semibold shadow-sm">{title}</h1></main>;
}
