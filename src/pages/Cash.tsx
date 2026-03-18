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
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { currency } from "@/lib/formatters";
import { canAttachCashReceipt, canCancelCashSale, canCloseCash, canCreateCashSale } from "@/lib/permissions";
import { openPrintWindow } from "@/lib/print";
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
import { buildCashClosurePrintHtml, todayDateInputValue } from "@/features/cash/utils";

export default function CashPage() {
  const { roles } = useAuth();
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
  const [isCloseNotesDirty, setIsCloseNotesDirty] = useState(false);
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("TODAS");
  const {
    customers,
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
    if (!isCloseNotesDirty) {
      setCloseNotes(closure.notes ?? "");
    }
  }, [closure, isCloseNotesDirty]);

  useEffect(() => {
    setIsCloseNotesDirty(false);
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
    if (!canAttachCashReceipt(roles)) return;
    setSelectedSale(sale);
    setPendingReceiptKind("REMITO");
    setPendingRemitoId("__none__");
    setPendingReceiptReference("");
    setReceiptDialogOpen(true);
  };

  const canCreateSale = canCreateCashSale(roles);
  const canCloseCashAction = canCloseCash(roles);
  const canCancelSale = (sale: CashSaleRow) => canCancelCashSale(roles) && !sale.closure_id;
  const canAttachReceipt = (sale: CashSaleRow) => canAttachCashReceipt(roles) && sale.status === "PENDIENTE_COMPROBANTE";
  const openClosurePreview = (closureId: string) => {
    setSelectedClosureId(closureId);
    setClosurePreviewOpen(true);
  };

  const openSaleDetail = (sale: CashSaleRow) => {
    setDetailSale(sale);
    setDetailDialogOpen(true);
  };

  const printClosurePreview = () => {
    if (!selectedClosurePreview) return;

    const win = openPrintWindow(
      buildCashClosurePrintHtml({
        closure: selectedClosurePreview,
        sales: selectedClosureSales,
        appName: companySettings.app_name,
        documentFooter: companySettings.document_footer,
      }),
      "width=1100,height=800",
    );
    if (!win) return;
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
                  if (!canCreateSale) return;
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

                <Button type="submit" className="w-full" disabled={createSaleMutation.isPending || !canCreateSale}>
                  {createSaleMutation.isPending ? "Guardando..." : "Registrar venta"}
                </Button>
                {!canCreateSale ? <p className="text-sm text-muted-foreground">Tu rol no tiene permiso para registrar ventas.</p> : null}
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
                onOpenDetail={openSaleDetail}
                onCancelSale={(saleId) => {
                  if (!canCancelCashSale(roles)) return;
                  cancelSaleMutation.mutate(saleId);
                }}
                canCancelSale={canCancelSale}
                cancelPending={cancelSaleMutation.isPending}
              />
            </TabsContent>

            <TabsContent value="pending">
              <CashPendingTab
                pendingSales={pendingSales}
                onAssignReceipt={openReceiptDialog}
                onCancelSale={(saleId) => {
                  if (!canCancelCashSale(roles)) return;
                  cancelSaleMutation.mutate(saleId);
                }}
                onOpenDetail={openSaleDetail}
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
                  setIsCloseNotesDirty(true);
                  setCloseNotes(value);
                }}
                onRecalculate={() => void refreshCash()}
                onCloseClosure={() => {
                  if (!canCloseCashAction) return;
                  closeClosureMutation.mutate();
                }}
                onOpenSummary={openClosurePreview}
                closePending={closeClosureMutation.isPending}
                canCloseCash={canCloseCashAction}
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
        canSave={canAttachCashReceipt(roles)}
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
        onCancelSale={(saleId) => {
          if (!canCancelCashSale(roles)) return;
          cancelSaleMutation.mutate(saleId);
        }}
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



