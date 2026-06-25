import { useEffect } from "react";
import { Download } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { usePublicDocument } from "@/features/documents/hooks/usePublicDocument";
import { buildDocumentPrintHtml } from "@/features/documents/print";
import { formatNumber } from "@/features/documents/utils";
import { openPrintWindow, withPrintDialogOnLoad } from "@/lib/print";

export default function PublicDocumentPage() {
  const { token } = useParams();
  const query = usePublicDocument(token ?? null);
  const payload = query.data;

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

  return (
    <main className="min-h-screen bg-slate-200">
      <div className="sticky top-0 z-20 border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-950">{label} {documentNumber}</p>
          <Button onClick={() => openPrintWindow(withPrintDialogOnLoad(html))}>
            <Download className="mr-2 h-4 w-4" /> Guardar PDF
          </Button>
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}

function PublicMessage({ title }: { title: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><h1 className="rounded-xl border bg-white px-6 py-5 text-lg font-semibold shadow-sm">{title}</h1></main>;
}
