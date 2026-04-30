import { useParams } from "react-router-dom";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { currency, formatIsoDate } from "@/lib/formatters";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import { SERVICE_STATUS_LABEL } from "@/features/services/constants";
import type { ServiceDocumentLine } from "@/features/services/types";

export default function PrintServiceDocumentPage() {
  const { id } = useParams();
  const { settings } = useCompanyBrand();
  const { selectedDocument, selectedLines } = useServiceDocuments({
    companyId: null,
    search: "",
    status: "ALL",
    documentId: id ?? null,
  });

  if (!id) return <div className="p-8">Documento no encontrado</div>;
  if (!selectedDocument) return <div className="p-8">Cargando presupuesto...</div>;
  const isRemito = selectedDocument.type === "REMITO";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          .print-sheet { width: 190mm !important; min-height: auto !important; box-shadow: none !important; border: 0 !important; }
          .print-action { display: none !important; }
        }
      `}</style>
      <section className="print-sheet mx-auto w-[190mm] min-h-[277mm] rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <header className="grid grid-cols-[1.2fr_.8fr] gap-6 border-b border-slate-200 pb-5">
          <div className="space-y-3">
            {settings.logo_url ? <img src={settings.logo_url} alt={settings.app_name} className="max-h-20 max-w-64 object-contain" /> : <h1 className="text-2xl font-extrabold tracking-tight">{settings.legal_name ?? settings.app_name}</h1>}
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{settings.legal_name ?? settings.app_name}</p>
              {settings.tax_id ? <p>CUIT: {settings.tax_id}</p> : null}
              {settings.address ? <p>{settings.address}</p> : null}
              {[settings.phone, settings.email].filter(Boolean).join(" | ")}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{isRemito ? "Remito de servicio" : "Presupuesto de servicio"}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">SERV-{String(selectedDocument.number).padStart(6, "0")}</p>
            <p className="mt-3 text-sm text-slate-200">Fecha: {formatIsoDate(selectedDocument.issue_date)}</p>
            {selectedDocument.valid_until ? <p className="text-sm text-slate-200">Vigencia: {formatIsoDate(selectedDocument.valid_until)}</p> : null}
            <p className="text-sm text-slate-200">Estado: {SERVICE_STATUS_LABEL[selectedDocument.status]}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cliente</p>
            <p className="mt-2 text-base font-bold">{selectedDocument.customers?.name ?? "Sin cliente"}</p>
            {selectedDocument.customers?.cuit ? <p className="text-slate-600">CUIT: {selectedDocument.customers.cuit}</p> : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Referencia</p>
            <p className="mt-2 text-base font-bold">{selectedDocument.reference || "-"}</p>
          </div>
        </section>

        {selectedDocument.intro_text ? <p className="mt-5 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedDocument.intro_text}</p> : null}

        <table className="mt-5 w-full border-collapse overflow-hidden rounded-xl text-sm">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-200 p-2">Trabajo</th>
              <th className="w-20 border border-slate-200 p-2 text-right">Cant.</th>
              <th className="w-20 border border-slate-200 p-2">Unidad</th>
              <th className="w-28 border border-slate-200 p-2 text-right">Unitario</th>
              <th className="w-28 border border-slate-200 p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(selectedLines as ServiceDocumentLine[]).map((line) => (
              <tr key={line.id}>
                <td className="whitespace-pre-line border border-slate-200 p-2">{line.description}</td>
                <td className="border border-slate-200 p-2 text-right">{line.quantity ?? "-"}</td>
                <td className="border border-slate-200 p-2">{line.unit ?? "-"}</td>
                <td className="border border-slate-200 p-2 text-right">{line.unit_price != null ? currency.format(Number(line.unit_price)) : "-"}</td>
                <td className="border border-slate-200 p-2 text-right font-semibold">{currency.format(Number(line.line_total ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-5 flex justify-end">
          <div className="w-64 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{currency.format(Number(selectedDocument.subtotal ?? 0))}</span></div>
            <div className="mt-2 flex justify-between text-xl font-extrabold"><span>Total</span><span>{currency.format(Number(selectedDocument.total ?? 0))}</span></div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-3 text-xs leading-5 text-slate-700">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><strong>Plazo de entrega</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.delivery_time || "-"}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><strong>Condiciones de pago</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.payment_terms || "-"}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><strong>Lugar de entrega</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.delivery_location || "-"}</p></div>
        </section>

        {selectedDocument.closing_text ? <p className="mt-5 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedDocument.closing_text}</p> : null}
      </section>
      <button className="print-action mx-auto mt-4 block rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
    </main>
  );
}
