import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { buildServiceDocumentPrintHtml } from "@/features/services/print";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";

export default function PrintServiceDocumentPage() {
  const { id } = useParams();
  const { settings } = useCompanyBrand();
  const { selectedDocument, selectedLines, selectedAttachments } = useServiceDocuments({
    companyId: null,
    search: "",
    status: "ALL",
    documentId: id ?? null,
  });

  useEffect(() => {
    if (selectedDocument) {
      window.setTimeout(() => window.print(), 250);
    }
  }, [selectedDocument]);

  if (!id) return <div className="p-8">Documento no encontrado</div>;
  if (!selectedDocument) return <div className="p-8">Cargando presupuesto...</div>;

  return (
    <div
      dangerouslySetInnerHTML={{
        __html: buildServiceDocumentPrintHtml({
          document: selectedDocument,
          lines: selectedLines,
          attachments: selectedAttachments,
          companySettings: settings,
        }),
      }}
    />
  );
}
