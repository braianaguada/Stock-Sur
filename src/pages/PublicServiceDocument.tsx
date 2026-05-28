import { useEffect } from "react";
import { Printer } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { buildServiceDocumentPrintHtml } from "@/features/services/print";
import { sanitizePdfFileName } from "@/features/services/share";
import { usePublicServiceDocument } from "@/features/services/hooks/usePublicServiceDocument";

export default function PublicServiceDocumentPage() {
  const { token } = useParams();
  const query = usePublicServiceDocument(token ?? null);
  const payload = query.data;

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (query.isLoading) return <PublicMessage title="Cargando presupuesto..." />;
  if (!payload || payload.status === "not_found") return <PublicMessage title="Presupuesto no encontrado" />;
  if (payload.status === "revoked") return <PublicMessage title="Este presupuesto ya no esta disponible" />;
  if (payload.status === "expired") return <PublicMessage title="Este link expiro" />;

  const fileName = `Presupuesto-Servicio-SERV-${String(payload.document.number).padStart(6, "0")}-${sanitizePdfFileName(payload.document.customers?.name ?? "cliente")}`;
  const html = buildServiceDocumentPrintHtml({
    document: payload.document,
    lines: payload.lines,
    attachments: payload.attachments,
    companySettings: { ...DEFAULT_COMPANY_SETTINGS, ...payload.company },
  });

  return (
    <main className="min-h-screen bg-slate-200">
      <div className="print-action sticky top-0 z-20 border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Presupuesto de servicio</p>
            <p className="text-xs text-slate-500">Usa imprimir para descargar o guardar como PDF.</p>
          </div>
          <Button
            onClick={() => {
              document.title = `${fileName}.pdf`;
              window.print();
            }}
          >
            <Printer className="mr-2 h-4 w-4" /> Descargar PDF
          </Button>
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}

function PublicMessage({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="rounded-xl border bg-white px-6 py-5 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">{title}</h1>
      </section>
    </main>
  );
}
