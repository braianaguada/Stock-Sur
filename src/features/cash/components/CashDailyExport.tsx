import { useEffect, useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { DAILY_REPORT_HEADERS, dailyReportTsv, loadDailyReport } from "../daily-report";

type SaveHandle = { createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }> };
type PickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle> };

export function CashDailyExport({ companyId, date }: { companyId: string; date: string }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const context = useRef({ companyId, date });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  context.current = { companyId, date };
  const exportReport = async (mode: "copy" | "file") => {
    setBusy(true);
    let writable: Awaited<ReturnType<SaveHandle["createWritable"]>> | undefined;
    try {
      const fileName = `Caja-${date}.xlsx`;
      const picker = (window as PickerWindow).showSaveFilePicker;
      const handle = mode === "file" && picker ? await picker.call(window, { suggestedName: fileName, types: [{ description: "Excel", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }] }) : null;
      const rows = await loadDailyReport(companyId, date);
      if (!mounted.current || context.current.companyId !== companyId || context.current.date !== date) return;
      if (!rows.length) { toast({ title: "No hay movimientos para exportar" }); return; }
      if (mode === "copy") {
        await navigator.clipboard.writeText(dailyReportTsv(rows));
        toast({ title: `${rows.length} movimientos copiados`, description: "Pegalos en la primera celda vacía de tu Excel." });
      } else {
        const XLSX = await import("xlsx");
        const book = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([DAILY_REPORT_HEADERS, ...rows]);
        sheet["!cols"] = [14, 8, 9, 14, 18, 24].map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(book, sheet, "Caja");
        const blob = new Blob([XLSX.write(book, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        if (!mounted.current || context.current.companyId !== companyId || context.current.date !== date) return;
        if (handle) {
          writable = await handle.createWritable(); await writable.write(blob); await writable.close(); writable = undefined;
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a"); link.href = url; link.download = fileName;
          document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        toast({ title: handle ? "Excel guardado" : "Descarga de Excel iniciada", description: fileName });
      }
    } catch (error) {
      await writable?.abort().catch(() => undefined);
      if (!mounted.current || context.current.companyId !== companyId || context.current.date !== date) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: "No se pudo exportar Caja", description: getErrorMessage(error, "Intenta nuevamente."), variant: "destructive" });
    } finally { if (mounted.current) setBusy(false); }
  };
  return <>
    <Button type="button" variant="outline" disabled={busy} onClick={() => void exportReport("copy")}><Copy className="mr-2 h-4 w-4" />Copiar para Excel</Button>
    <Button type="button" variant="outline" disabled={busy} onClick={() => void exportReport("file")}><Download className="mr-2 h-4 w-4" />{busy ? "Preparando…" : "Excel del día"}</Button>
  </>;
}
