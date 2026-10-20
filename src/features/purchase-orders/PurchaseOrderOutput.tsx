import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { savePrintHtmlAsPdf, type PdfSaveResult } from "@/lib/pdf-download";
import { buildPurchaseOrderModelHtml } from "./print-model";
import type { SupplierPurchaseOrder, SupplierPurchaseOrderLine } from "./types";

export function PurchaseOrderOutput({ order, lines, loading }: { order: SupplierPurchaseOrder; lines: SupplierPurchaseOrderLine[]; loading: boolean }) {
  const { currentCompany } = useAuth();
  const { settings, isLoading } = useCompanyBrand();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<PdfSaveResult | null>(null);
  const mounted = useRef(true);
  const context = `${currentCompany?.id}:${order.id}:${order.updated_at}`;
  const current = useRef(context);
  current.current = context;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setPdf(null); }, [context]);
  const enabled = !loading && !isLoading && !busy && lines.length > 0 && currentCompany?.id === order.company_id && settings.company_id === order.company_id;
  const html = () => buildPurchaseOrderModelHtml(settings, { firstNumber: order.order_number, secondNumber: order.order_number + 1 }, order.form_data?.date ?? new Date(order.created_at).toLocaleDateString("es-AR"), {
    number: order.order_number, supplier: order.supplier_name_snapshot, form: { ...order.form_data, notes: order.notes ?? "" }, totals: order.totals_by_currency, vatRate: order.vat_rate_snapshot, freightRate: order.freight_rate_snapshot,
    lines: lines.map(line => ({ description: [line.supplier_code_snapshot, line.product_name_snapshot, line.additional_description_snapshot].filter(Boolean).join(" - "), quantity: Number(line.quantity), currency: line.currency, unitCost: Number(line.unit_cost), total: Number(line.line_total) })),
  });
  const fail = (error: unknown) => toast({ title: "No se pudo preparar la orden", description: error instanceof Error ? error.message : "Volvé a intentar.", variant: "destructive" });
  const print = async () => {
    if (!enabled) return;
    const popup = window.open("", "_blank");
    if (!popup) { fail(new Error("Permití las ventanas emergentes para imprimir.")); return; }
    popup.opener = null;
    setBusy(true);
    try {
      popup.document.write(html()); popup.document.close();
      await Promise.all(Array.from(popup.document.images, image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
      if (!mounted.current || current.current !== context) popup.close();
      else { popup.focus(); popup.print(); }
    } catch (error) { popup.close(); fail(error); }
    finally { if (mounted.current) setBusy(false); }
  };
  const download = async () => {
    if (!enabled) return;
    setBusy(true);
    try {
      const result = await savePrintHtmlAsPdf({ html: html(), fileName: `Orden-compra-${order.order_number}.pdf`, proof: { mode: "authenticated", kind: "purchase_order", documentId: order.id } });
      if (!mounted.current || current.current !== context) return;
      setPdf(result);
      toast({ title: result.method === "saved" ? "PDF guardado" : "PDF descargado", description: `${result.fileName}. Podés adjuntarlo en WhatsApp o compartirlo desde aquí.` });
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) fail(error); }
    finally { if (mounted.current) setBusy(false); }
  };
  const share = async () => {
    if (!enabled || !pdf) return;
    const file = new File([pdf.blob], pdf.fileName, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try { await navigator.share({ files: [file], title: `Orden de compra ${order.order_number}` }); }
      catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) fail(error); }
    } else {
      toast({ title: "Adjuntá el PDF descargado en WhatsApp", description: "Este navegador no permite compartir archivos directamente. El mensaje se abre sin adjunto." });
      window.open(`https://wa.me/?text=${encodeURIComponent(`Orden de compra ${order.order_number} para ${order.supplier_name_snapshot}.`)}`, "_blank", "noopener,noreferrer");
    }
  };
  return <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!enabled} onClick={() => void print()}>Imprimir orden</Button><Button variant="outline" disabled={!enabled} onClick={() => void download()}>{busy ? "Preparando..." : "Descargar PDF"}</Button>{pdf && <Button variant="outline" disabled={!enabled} onClick={() => void share()}>Compartir PDF / WhatsApp</Button>}</div>;
}
