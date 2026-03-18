import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { currency, formatBusinessDate, formatDateTime } from "@/lib/formatters";
import { STATUS_CLASS, STATUS_LABEL } from "@/features/cash/constants";
import { CashClosureTab } from "@/features/cash/components/CashClosureTab";
import { CashClosurePreviewDialog } from "@/features/cash/components/CashClosurePreviewDialog";
import { CashDocumentPreviewDialog } from "@/features/cash/components/CashDocumentPreviewDialog";
import { CashHistoryTab } from "@/features/cash/components/CashHistoryTab";
import { CashPendingTab } from "@/features/cash/components/CashPendingTab";
import { CashReceiptDialog } from "@/features/cash/components/CashReceiptDialog";
import { CashSalesTab } from "@/features/cash/components/CashSalesTab";
import { CashSummaryCards } from "@/features/cash/components/CashSummaryCards";
import { useCashData } from "@/features/cash/hooks/useCashData";
import { useCashMutations } from "@/features/cash/hooks/useCashMutations";
import type { CashPendingReceiptState, CashSaleFormState, CashSaleRow, PaymentMethod, ReceiptKind, SituationFilter } from "@/features/cash/types";
import { todayDateInputValue } from "@/features/cash/utils";

export default function CashPage() {
  const { toast } = useToast();
  const { settings: companySettings } = useCompanyBrand();
  const [businessDate, setBusinessDate] = useState(todayDateInputValue());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const [receiptKind, setReceiptKind] = useState<ReceiptKind>("PENDIENTE");
  const [customerId, setCustomerId] = useState<string>("__none__");
  const [selectedRemitoId, setSelectedRemitoId] = useState<string>("__none__");
  const [receiptReference, setReceiptReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<CashSaleRow | null>(null);
  const [pendingReceiptKind, setPendingReceiptKind] = useState<ReceiptKind>("REMITO");
  const [pendingRemitoId, setPendingRemitoId] = useState<string>("__none__");
  const [pendingReceiptReference, setPendingReceiptReference] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<CashSaleRow | null>(null);
  const [closurePreviewOpen, setClosurePreviewOpen] = useState(false);
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);
  const [closeNotes, setCloseNotes] = useState("");
  const [closureInputDirty, setClosureInputDirty] = useState({
    notes: false,
  });
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("TODAS");
  const {
    customers,
    sales,
    remitos,
    closure,
    closureLoading,
    closureError,
    salesLoading,
    salesError,
    remitosError,
    linkedDocument,
    linkedDocumentLines,
    linkedDocumentEvents,
    closuresHistory,
    selectedClosureSales,
    summary,
    pendingSales,
    effectiveClosure,
    hasClosedClosureForDay,
    availableRemitos,
    unclosedSalesAfterClosure,
    filteredSales,
    selectedClosurePreview,
    refreshCash,
  } = useCashData({
    businessDate,
    detailDocumentId: detailSale?.document_id ?? null,
    selectedClosureId,
    situationFilter,
  });

  useEffect(() => {
    if (!closure) return;
    if (!closureInputDirty.notes) {
      setCloseNotes(closure.notes ?? "");
    }
  }, [closure, closureInputDirty]);

  useEffect(() => {
    setClosureInputDirty({
      notes: false,
    });
  }, [businessDate]);

  useEffect(() => {
    if (receiptKind !== "REMITO") {
      setSelectedRemitoId("__none__");
    }
    if (receiptKind !== "FACTURA") {
      setReceiptReference("");
    }
  }, [receiptKind]);

  useEffect(() => {
    if (pendingReceiptKind !== "REMITO") {
      setPendingRemitoId("__none__");
    }
    if (pendingReceiptKind !== "FACTURA") {
      setPendingReceiptReference("");
    }
  }, [pendingReceiptKind]);

  const resetSaleForm = () => {
    setAmount("");
    setPaymentMethod("EFECTIVO");
    setReceiptKind("PENDIENTE");
    setCustomerId("__none__");
    setSelectedRemitoId("__none__");
    setReceiptReference("");
    setNotes("");
  };

  const resetPendingReceiptForm = () => {
    setReceiptDialogOpen(false);
    setSelectedSale(null);
    setPendingReceiptKind("REMITO");
    setPendingRemitoId("__none__");
    setPendingReceiptReference("");
  };

  const { createSaleMutation, attachReceiptMutation, cancelSaleMutation, closeClosureMutation } = useCashMutations({
    businessDate,
    customers,
    remitos,
    closure,
    closureError,
    closeNotes,
    refreshCash,
    toast,
    onCreateSaleSuccess: resetSaleForm,
    onAttachReceiptSuccess: resetPendingReceiptForm,
  });

  const openReceiptDialog = (sale: CashSaleRow) => {
    setSelectedSale(sale);
    setPendingReceiptKind("REMITO");
    setPendingRemitoId("__none__");
    setPendingReceiptReference("");
    setReceiptDialogOpen(true);
  };

  const canCancelSale = (sale: CashSaleRow) => !sale.closure_id;
  const canAttachReceipt = (sale: CashSaleRow) => sale.status === "PENDIENTE_COMPROBANTE";
  const openClosurePreview = (closureId: string) => {
    setSelectedClosureId(closureId);
    setClosurePreviewOpen(true);
  };

  const printClosurePreview = () => {
    if (!selectedClosurePreview) return;
    const rows = selectedClosureSales.map((sale) => `
      <tr>
        <td>${new Date(sale.sold_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${sale.customer_name_snapshot ?? "Consumidor final"}</td>
        <td>${PAYMENT_LABEL[sale.payment_method]}</td>
        <td>${sale.receipt_reference ?? RECEIPT_LABEL[sale.receipt_kind]}</td>
        <td style="text-align:right">${currency.format(Number(sale.amount_total))}</td>
      </tr>
    `).join("");

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Cierre ${selectedClosurePreview.business_date}</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body{font-family:Arial,sans-serif;color:#0f172a;margin:0;font-size:11px;line-height:1.25}
      h1,h2,h3,p{margin:0}
      .sheet{width:100%;max-width:190mm;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
      .title{font-size:20px;font-weight:800;line-height:1}
      .sub{margin-top:4px;color:#64748b;font-size:10px}
      .status{border-radius:10px;background:#0f172a;color:#fff;padding:8px 10px;min-width:96px;text-align:right}
      .status .k{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#cbd5e1}
      .status .v{margin-top:4px;font-size:15px;font-weight:700}
      .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:8px;margin-bottom:8px}
      .hero{border:1px solid #cbd5e1;border-radius:14px;padding:10px;background:linear-gradient(135deg,#fff,#f8fafc)}
      .hero-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
      .mini{border:1px solid #dbeafe;border-radius:10px;padding:8px;background:#fff}
      .mini.alt-green{border-color:#bbf7d0;background:#f0fdf4}
      .mini.alt-blue{border-color:#bfdbfe;background:#eff6ff}
      .mini.alt-violet{border-color:#ddd6fe;background:#f5f3ff}
      .eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#64748b}
      .big{margin-top:4px;font-size:18px;font-weight:800}
      .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .card{border:1px solid #cbd5e1;border-radius:12px;padding:8px;background:#fff}
      .card strong{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
      .card .value{font-size:16px;font-weight:800}
      .manual-box{margin-top:6px;height:42px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc}
      .note{grid-column:1 / -1;border:1px dashed #cbd5e1;border-radius:12px;padding:8px;min-height:92px}
      table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
      thead th{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #cbd5e1;padding:5px 6px;text-align:left}
      tbody td{border-bottom:1px solid #e2e8f0;padding:5px 6px;font-size:10px;vertical-align:top}
      tbody tr:last-child td{border-bottom:none}
      .right{text-align:right}
      .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .truncate{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;color:#64748b;font-size:9px}
    </style></head><body>
      <div class="sheet">
        <div class="header">
          <div>
            <div class="title">Cierre diario ${formatBusinessDate(selectedClosurePreview.business_date)}</div>
            <div class="sub">Generado por ${companySettings.app_name} · ${selectedClosurePreview.status === "CERRADO" ? `Cerrado ${formatDateTime(selectedClosurePreview.closed_at)}` : "Caja abierta"}</div>
          </div>
          <div class="status">
            <div class="k">Estado</div>
            <div class="v">${selectedClosurePreview.status === "CERRADO" ? "Cerrado" : "Abierto"}</div>
          </div>
        </div>

        <div class="grid">
          <div class="hero">
            <div class="eyebrow">Resumen operativo</div>
            <div class="hero-grid">
              <div class="mini alt-green">
                <div class="eyebrow">Efectivo esperado</div>
                <div class="big">${currency.format(Number(selectedClosurePreview.expected_cash_to_render))}</div>
              </div>
              <div class="mini">
                <div class="eyebrow">Total ventas</div>
                <div class="big">${currency.format(Number(selectedClosurePreview.expected_sales_total))}</div>
                <div class="sub">Movimientos: ${selectedClosureSales.length}</div>
              </div>
              <div class="mini alt-blue">
                <div class="eyebrow">Point</div>
                <div class="big">${currency.format(Number(selectedClosurePreview.expected_point_sales_total))}</div>
              </div>
              <div class="mini alt-violet">
                <div class="eyebrow">Transferencias</div>
                <div class="big">${currency.format(Number(selectedClosurePreview.expected_transfer_sales_total))}</div>
              </div>
            </div>
          </div>

          <div class="cards">
            <div class="card">
              <strong>Efectivo real</strong>
              <div class="manual-box"></div>
            </div>
            <div class="card">
              <strong>Diferencia</strong>
              <div class="manual-box"></div>
            </div>
            <div class="note">
              <strong style="display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px">Notas</strong>
              <div>${selectedClosurePreview.notes ?? "Sin observaciones"}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:12%">Hora</th>
              <th style="width:30%">Cliente</th>
              <th style="width:16%">Pago</th>
              <th style="width:24%">Comprobante</th>
              <th class="right" style="width:18%">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <span>Hoja diaria de caja</span>
          <span>${companySettings.document_footer ?? "Control interno"}</span>
        </div>
      </div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
            <p className="text-muted-foreground">Carga rapida, pendientes de comprobante y cierre diario en una sola vista.</p>
          </div>
          <div className="w-full max-w-[155px]">
            <Label htmlFor="business-date">Fecha operativa</Label>
            <Input id="business-date" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} className="h-10" />
          </div>
        </div>

        {salesError || remitosError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {salesError
              ? getErrorMessage(salesError, "No se pudo cargar Caja.")
              : remitosError
                ? getErrorMessage(remitosError, "No se pudo cargar Caja.")
                : "No se pudo cargar Caja."}
          </div>
        ) : null}

        {hasClosedClosureForDay && unclosedSalesAfterClosure.length > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Hay {unclosedSalesAfterClosure.length} movimiento{unclosedSalesAfterClosure.length === 1 ? "" : "s"} posterior{unclosedSalesAfterClosure.length === 1 ? "" : "es"} al cierre. No forman parte de la caja ya cerrada.
          </div>
        ) : null}

        <CashSummaryCards summary={summary} />

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-primary/10 shadow-sm">
            <CardHeader>
              <CardTitle>Nueva venta</CardTitle>
              <CardDescription>Captura minima para registrar la operacion sin quedar bloqueado por el comprobante.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createSaleMutation.mutate({
                    amount,
                    paymentMethod,
                    receiptKind,
                    customerId,
                    selectedRemitoId,
                    receiptReference,
                    notes,
                  } satisfies CashSaleFormState);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="amount">Importe</Label>
                  <Input id="amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label>Medio de pago</Label>
                    <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                        <SelectItem value="POINT">Point</SelectItem>
                        <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                        <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Comprobante</Label>
                    <Select value={receiptKind} onValueChange={(value) => setReceiptKind(value as ReceiptKind)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDIENTE">Definir despues</SelectItem>
                        <SelectItem value="REMITO">Remito</SelectItem>
                        <SelectItem value="FACTURA">Factura</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Consumidor final" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Consumidor final</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}{customer.cuit ? ` · ${customer.cuit}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {receiptKind === "REMITO" && (
                  <div className="space-y-2">
                    <Label>Remito emitido</Label>
                    <Select value={selectedRemitoId} onValueChange={setSelectedRemitoId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar remito del dia" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Seleccionar remito del dia</SelectItem>
                        {availableRemitos.map((remito) => (
                          <SelectItem key={remito.id} value={remito.id}>
                            {formatRemitoOptionLabel(remito)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {receiptKind === "FACTURA" && (
                  <div className="space-y-2">
                    <Label htmlFor="receipt-reference">Referencia de factura</Label>
                    <Input
                      id="receipt-reference"
                      placeholder="Ej. 0009-00001782"
                      value={receiptReference}
                      onChange={(event) => setReceiptReference(event.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Observaciones</Label>
                  <Textarea id="notes" placeholder="Cliente, detalle rapido o algo util para revisar la venta despues" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
                </div>

                <Button type="submit" className="w-full" disabled={createSaleMutation.isPending}>
                  {createSaleMutation.isPending ? "Guardando..." : "Registrar venta"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Tabs defaultValue="day" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="day">Caja del dia</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="closure">Cierre diario</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="day">
              <CashSalesTab
                filteredSales={filteredSales}
                salesLoading={salesLoading}
                situationFilter={situationFilter}
                onSituationFilterChange={setSituationFilter}
                hasClosedClosureForDay={hasClosedClosureForDay}
                onOpenDetail={(sale) => {
                  setDetailSale(sale);
                  setDetailDialogOpen(true);
                }}
                onCancelSale={(saleId) => cancelSaleMutation.mutate(saleId)}
                canCancelSale={canCancelSale}
                cancelPending={cancelSaleMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="pending">
              <CashPendingTab
                pendingSales={pendingSales}
                onAssignReceipt={openReceiptDialog}
                onCancelSale={(saleId) => cancelSaleMutation.mutate(saleId)}
                onOpenDetail={(sale) => {
                  setDetailSale(sale);
                  setDetailDialogOpen(true);
                }}
                canAttachReceipt={canAttachReceipt}
                canCancelSale={canCancelSale}
                cancelPending={cancelSaleMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="closure">
              <CashClosureTab
                effectiveClosure={effectiveClosure}
                closureLoading={closureLoading}
                closureError={closureError}
                closeNotes={closeNotes}
                onCloseNotesChange={(value) => {
                  setClosureInputDirty((current) => ({ ...current, notes: true }));
                  setCloseNotes(value);
                }}
                onRecalculate={() => void refreshCash()}
                onCloseClosure={() => closeClosureMutation.mutate()}
                onOpenSummary={openClosurePreview}
                closePending={closeClosureMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="history">
              <CashHistoryTab closuresHistory={closuresHistory} onOpenSummary={openClosurePreview} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CashReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        selectedSale={selectedSale}
        pendingReceiptKind={pendingReceiptKind}
        pendingRemitoId={pendingRemitoId}
        pendingReceiptReference={pendingReceiptReference}
        availableRemitos={availableRemitos}
        saving={attachReceiptMutation.isPending}
        onPendingReceiptKindChange={setPendingReceiptKind}
        onPendingRemitoIdChange={setPendingRemitoId}
        onPendingReceiptReferenceChange={setPendingReceiptReference}
        onSave={(state) => attachReceiptMutation.mutate(state satisfies CashPendingReceiptState)}
      />
      <CashDocumentPreviewDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        detailSale={detailSale}
        linkedDocument={linkedDocument}
        linkedDocumentLines={linkedDocumentLines}
        linkedDocumentEvents={linkedDocumentEvents}
        companyBrand={{
          appName: companySettings.app_name,
          logoUrl: companySettings.logo_url,
          documentTagline: companySettings.document_tagline,
        }}
        canAttachReceipt={canAttachReceipt}
        canCancelSale={canCancelSale}
        onAssignReceipt={openReceiptDialog}
        onCancelSale={(saleId) => cancelSaleMutation.mutate(saleId)}
        cancelPending={cancelSaleMutation.isPending}
      />

      <CashClosurePreviewDialog
        open={closurePreviewOpen}
        onOpenChange={setClosurePreviewOpen}
        selectedClosurePreview={selectedClosurePreview}
        selectedClosureSales={selectedClosureSales}
        onPrint={printClosurePreview}
      />
    </AppLayout>
  );
}


