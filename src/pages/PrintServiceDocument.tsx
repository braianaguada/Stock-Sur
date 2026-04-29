import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { currency, formatIsoDate } from "@/lib/formatters";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import { SERVICE_STATUS_LABEL } from "@/features/services/constants";
import type { ServiceDocumentLine } from "@/features/services/types";

export default function PrintServiceDocumentPage() {
  const { id } = useParams();
  const { settings } = useCompanyBrand();
  const printRequestedRef = useRef(false);
  const { selectedDocument, selectedLines } = useServiceDocuments({
    companyId: null,
    search: "",
    status: "ALL",
    documentId: id ?? null,
  });

  const companyContact = [settings.phone, settings.email, settings.whatsapp].filter(Boolean).join(" | ");

  useEffect(() => {
    if (!selectedDocument || printRequestedRef.current) return;
    printRequestedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [selectedDocument]);

  if (!id) return <div className="p-8">Documento no encontrado</div>;
  if (!selectedDocument) return <div className="p-8">Cargando presupuesto...</div>;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 print:bg-white print:p-0">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          body { margin: 0 !important; background: #fff !important; }
          .print-sheet { width: 194mm !important; min-height: auto !important; margin: 0 !important; box-shadow: none !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; }
          .print-action { display: none !important; }
        }
      `}</style>
      <section className="print-sheet mx-auto w-[194mm] rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        <header className="grid grid-cols-[1.25fr_.75fr] gap-5 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.app_name} className="max-h-16 max-w-56 object-contain" />
            ) : (
              <h1 className="text-2xl font-extrabold tracking-tight">{settings.legal_name ?? settings.app_name}</h1>
            )}
            <div className="mt-3 space-y-0.5 text-[11px] leading-5 text-slate-600">
              <p className="text-sm font-bold text-slate-900">{settings.legal_name ?? settings.app_name}</p>
              {settings.tax_id ? <p>CUIT: {settings.tax_id}</p> : null}
              {settings.address ? <p>{settings.address}</p> : null}
              {companyContact ? <p>{companyContact}</p> : null}
            </div>
          </div>
          <div className="rounded-xl bg-slate-950 p-4 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">Presupuesto de servicio</p>
            <p className="mt-3 text-2xl font-black tracking-tight">SERV-{String(selectedDocument.number).padStart(6, "0")}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-200">
              <p>Fecha: {formatIsoDate(selectedDocument.issue_date)}</p>
              {selectedDocument.valid_until ? <p>Vigencia: {formatIsoDate(selectedDocument.valid_until)}</p> : null}
              <p>Estado: {SERVICE_STATUS_LABEL[selectedDocument.status]}</p>
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-[1.1fr_.9fr] gap-3 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">Cliente</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{selectedDocument.customers?.name ?? "Sin cliente"}</p>
            {selectedDocument.customers?.cuit ? <p className="mt-0.5 text-slate-600">CUIT: {selectedDocument.customers.cuit}</p> : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="font-semibold uppercase tracking-[0.16em] text-slate-500">Referencia</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{selectedDocument.reference || "-"}</p>
          </div>
        </section>

        {selectedDocument.intro_text ? <p className="mt-4 whitespace-pre-line text-[12px] leading-5 text-slate-700">{selectedDocument.intro_text}</p> : null}

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-950 text-left text-white">
              <th className="border border-slate-950 px-2 py-2">Trabajo</th>
              <th className="w-16 border border-slate-950 px-2 py-2 text-right">Cant.</th>
              <th className="w-16 border border-slate-950 px-2 py-2">Unidad</th>
              <th className="w-24 border border-slate-950 px-2 py-2 text-right">Unitario</th>
              <th className="w-24 border border-slate-950 px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(selectedLines as ServiceDocumentLine[]).map((line) => (
              <tr key={line.id}>
                <td className="whitespace-pre-line border border-slate-200 px-2 py-2 leading-4">{line.description}</td>
                <td className="border border-slate-200 px-2 py-2 text-right align-top">{line.quantity ?? "-"}</td>
                <td className="border border-slate-200 px-2 py-2 align-top">{line.unit ?? "-"}</td>
                <td className="border border-slate-200 px-2 py-2 text-right align-top">{line.unit_price != null ? currency.format(Number(line.unit_price)) : "-"}</td>
                <td className="border border-slate-200 px-2 py-2 text-right align-top font-semibold">{currency.format(Number(line.line_total ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <div className="w-60 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-xs"><span>Subtotal</span><span>{currency.format(Number(selectedDocument.subtotal ?? 0))}</span></div>
            <div className="mt-2 flex justify-between text-lg font-extrabold"><span>Total</span><span>{currency.format(Number(selectedDocument.total ?? 0))}</span></div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 text-[10px] leading-4 text-slate-700">
          <div className="rounded-lg border border-slate-200 p-2.5"><strong>Plazo de entrega</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.delivery_time || "-"}</p></div>
          <div className="rounded-lg border border-slate-200 p-2.5"><strong>Condiciones de pago</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.payment_terms || "-"}</p></div>
          <div className="rounded-lg border border-slate-200 p-2.5"><strong>Lugar de entrega</strong><p className="mt-1 whitespace-pre-line">{selectedDocument.delivery_location || "-"}</p></div>
        </section>

        {selectedDocument.closing_text ? <p className="mt-4 whitespace-pre-line text-[12px] leading-5 text-slate-700">{selectedDocument.closing_text}</p> : null}

        <footer className="mt-6 grid grid-cols-[1fr_180px] items-end gap-6 text-[10px] text-slate-500">
          <p>Presupuesto generado por {settings.app_name}. Valido segun condiciones comerciales indicadas.</p>
          <div className="border-t border-slate-300 pt-2 text-center text-slate-600">Firma / conformidad</div>
        </footer>
      </section>
      <button className="print-action mx-auto mt-4 block rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white shadow-sm" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
    </main>
  );
}
