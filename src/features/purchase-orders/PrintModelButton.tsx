import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildPurchaseOrderModelHtml, type PrintBatch } from "./print-model";

type PrintClient = { rpc: (name: "reserve_purchase_order_print_batch", args: { p_company_id: string; p_request_id: string }) => PromiseLike<{ data: PrintBatch | null; error: { message: string } | null }> };

export function PrintModelButton() {
  const { currentCompany, companyPermissionCodes } = useAuth();
  const { settings, isLoading } = useCompanyBrand();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const request = useRef<{ companyId: string; id: string; html?: string } | null>(null);
  const companyId = currentCompany?.id;
  const activeCompany = useRef(companyId);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  activeCompany.current = companyId;
  if (!companyId) return null;
  const canPrint = companyPermissionCodes.includes("suppliers.edit");

  const print = async (reuse: boolean) => {
    if (!canPrint || busy || isLoading || settings.company_id !== companyId) return;
    const popup = window.open("", "_blank");
    if (!popup) { toast({ title: "Permití las ventanas emergentes para imprimir", variant: "destructive" }); return; }
    popup.opener = null;
    popup.document.write("<p>Preparando órdenes de compra…</p>");
    const current = reuse && request.current?.companyId === companyId ? request.current : { companyId, id: crypto.randomUUID() };
    request.current = current;
    setBusy(true);
    try {
      if (!current.html) {
        const { data, error } = await (supabase as unknown as PrintClient).rpc("reserve_purchase_order_print_batch", { p_company_id: companyId, p_request_id: current.id });
        if (error) throw new Error(error.message);
        if (!data || !Number.isSafeInteger(data.firstNumber) || data.secondNumber !== data.firstNumber + 1) throw new Error("La numeración recibida no es válida.");
        current.html = buildPurchaseOrderModelHtml(settings, data, new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
      }
      if (!mounted.current || activeCompany.current !== companyId) { popup.close(); return; }
      popup.document.open(); popup.document.write(current.html); popup.document.close();
      await Promise.all(Array.from(popup.document.images, img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })));
      if (!mounted.current || activeCompany.current !== companyId) popup.close();
      else if (!popup.closed) { popup.focus(); popup.print(); }
    } catch (error) {
      popup.close();
      toast({ title: "No se pudo preparar la impresión", description: error instanceof Error ? error.message : "Volvé a intentar.", variant: "destructive" });
    } finally { setBusy(false); }
  };
  const canRetry = request.current?.companyId === companyId;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!canPrint || busy || isLoading || settings.company_id !== companyId} onClick={() => void print(false)}>
          <Printer className="mr-2 h-4 w-4" />{busy ? "Preparando…" : "Imprimir órdenes de compra"}
        </Button>
        {canRetry ? <Button variant="ghost" disabled={!canPrint || busy} onClick={() => void print(true)}>Reimprimir misma hoja</Button> : null}
      </div>
      <p className="text-xs text-muted-foreground">{canPrint ? "2 órdenes en blanco por hoja A4." : "Necesitás permiso para editar proveedores para imprimir órdenes."}</p>
    </div>
  );
}
