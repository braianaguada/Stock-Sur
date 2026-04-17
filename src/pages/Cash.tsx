import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { getErrorMessage } from "@/lib/errors";
import { canAttachCashReceipt, canCancelCashSale, canCloseCash, canCreateCashSale } from "@/lib/permissions";
import { openPrintWindow } from "@/lib/print";
import { Plus } from "lucide-react";
import { CashClosureTab } from "@/features/cash/components/CashClosureTab";
import { CashHistoryTab } from "@/features/cash/components/CashHistoryTab";
import { CashPendingTab } from "@/features/cash/components/CashPendingTab";
import { CashSalesTab } from "@/features/cash/components/CashSalesTab";
import { CashSummaryCards } from "@/features/cash/components/CashSummaryCards";
import { useCashData } from "@/features/cash/hooks/useCashData";
import { useCashMutations } from "@/features/cash/hooks/useCashMutations";
import type {
  CashPendingReceiptState,
  CashSaleFormState,
  CashSaleRow,
  PaymentMethod,
  ReceiptKind,
  SituationFilter,
} from "@/features/cash/types";
import {
  buildCashClosurePrintHtml,
  formatRemitoOptionLabel,
  todayDateInputValue,
} from "@/features/cash/utils";
import { PageHeader } from "@/components/ui/page";

const CashReceiptDialog = lazy(async () => {
  const module = await import("@/features/cash/components/CashReceiptDialog");
  return { default: module.CashReceiptDialog };
});

const CashDocumentPreviewDialog = lazy(async () => {
  const module = await import("@/features/cash/components/CashDocumentPreviewDialog");
  return { default: module.CashDocumentPreviewDialog };
});

const CashClosurePreviewDialog = lazy(async () => {
  const module = await import("@/features/cash/components/CashClosurePreviewDialog");
  return { default: module.CashClosurePreviewDialog };
});

function CashDialogLoader() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Cargando detalle...
    </div>
  );
}

export default function CashPage() {
  const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;
  const { roles, currentCompany } = useAuth();
  const { toast } = useToast();
  const { settings: companySettings } = useCompanyBrand();
  const [businessDate, setBusinessDate] = useState(todayDateInputValue());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("EFECTIVO_REMITO");
  const [receiptKind, setReceiptKind] = useState<ReceiptKind>("REMITO");
  const [selectedRemitoId, setSelectedRemitoId] = useState<string>("__none__");
  const [receiptSearch, setReceiptSearch] = useState("");
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
  const [tab, setTab] = useState("day");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const saleFormRef = useRef<HTMLDivElement | null>(null);

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
    availableFacturableRemitos,
    unclosedSalesAfterClosure,
    filteredSales,
    selectedClosurePreview,
    refreshCash,
  } = useCashData({
    businessDate,
    detailDocumentId: detailSale?.document_id ?? null,
    selectedClosureId,
    situationFilter,
    currentCompanyId: currentCompany?.id ?? null,
  });
  const remitosById = useMemo(() => new Map(remitos.map((remito) => [remito.id, remito])), [remitos]);
  const selectedReceiptRemito = useMemo(
    () => remitosById.get(selectedRemitoId) ?? null,
    [remitosById, selectedRemitoId],
  );
  const derivedAmount = selectedReceiptRemito ? Number(selectedReceiptRemito.total).toFixed(2) : "";

  useEffect(() => {
    if (!closure || isCloseNotesDirty) return;
    setCloseNotes(closure.notes ?? "");
  }, [closure, isCloseNotesDirty]);

  useEffect(() => {
    setIsCloseNotesDirty(false);
  }, [businessDate]);

  useEffect(() => {
    setSelectedRemitoId("__none__");
    setReceiptReference("");
  }, [receiptKind]);

  useEffect(() => {
    if (pendingReceiptKind === "REMITO") {
      setPendingRemitoId("__none__");
    }
  }, [pendingReceiptKind]);

  useEffect(() => {
    setHistoryPage(1);
  }, [closuresHistory.length, historyPageSize]);

  const resetSaleForm = () => {
    setPaymentMethod("EFECTIVO_REMITO");
    setReceiptKind("REMITO");
    setSelectedRemitoId("__none__");
    setReceiptSearch("");
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

  const {
    createSaleMutation,
    attachReceiptMutation,
    cancelSaleMutation,
    closeClosureMutation,
  } = useCashMutations({
    currentCompanyId: currentCompany?.id ?? null,
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

  const customerOptionLabels = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          `${customer.name}${customer.cuit ? ` - ${customer.cuit}` : ""}`,
        ]),
      ),
    [customers],
  );

  const remitoOptionLabels = useMemo(
    () => new Map(availableRemitos.map((remito) => [remito.id, formatRemitoOptionLabel(remito)])),
    [availableRemitos],
  );
  const receiptOptions = receiptKind === "REMITO" ? availableRemitos : availableFacturableRemitos;
  const filteredReceiptOptions = useMemo(() => {
    const query = receiptSearch.trim().toLowerCase();
    if (!query) return receiptOptions;
    return receiptOptions.filter((remito) => {
      const label = remitoOptionLabels.get(remito.id) ?? formatRemitoOptionLabel(remito);
      return label.toLowerCase().includes(query);
    });
  }, [receiptOptions, remitoOptionLabels, receiptSearch]);
  const historyPagination = usePaginationSlice({
    items: closuresHistory,
    page: historyPage,
    pageSize: historyPageSize,
  });

  const canCreateSale = canCreateCashSale(roles);
  const canCloseCashAction = canCloseCash(roles);
  const canCancelSale = (sale: CashSaleRow) => canCancelCashSale(roles) && !sale.closure_id;
  const canAttachReceipt = (sale: CashSaleRow) =>
    canAttachCashReceipt(roles) && sale.status === "PENDIENTE_COMPROBANTE";

  const openReceiptDialog = (sale: CashSaleRow) => {
    if (!canAttachCashReceipt(roles)) return;
    setSelectedSale(sale);
    setPendingReceiptKind("REMITO");
    setPendingRemitoId("__none__");
    setPendingReceiptReference("");
    setReceiptDialogOpen(true);
  };

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
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para registrar ventas, asociar comprobantes y cerrar caja." />
        ) : null}

        <PageHeader
          eyebrow="Caja y cierre diario"
          title="Caja"
          subtitle="Carga rapida, pendientes y cierre diario en una sola vista. La mejora es visual y de jerarquia, sin tocar el flujo."
          tabs={[
            { label: "Hoy", value: "day" },
            { label: "Pendientes", value: "pending" },
            { label: "Cierre", value: "closure" },
            { label: "Historial", value: "history" },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          actions={(
            <div className="flex flex-wrap items-end gap-3">
              <Button
                onClick={() =>
                  saleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Nueva venta
              </Button>
              <div className="w-full max-w-[180px]">
                <Label htmlFor="business-date">Fecha operativa</Label>
                <Input
                  id="business-date"
                  type="date"
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                />
              </div>
            </div>
          )}
        />

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
            Hay {unclosedSalesAfterClosure.length} movimiento
            {unclosedSalesAfterClosure.length === 1 ? "" : "s"} posterior
            {unclosedSalesAfterClosure.length === 1 ? "" : "es"} al cierre. No forman parte de la
            caja ya cerrada.
          </div>
        ) : null}

        <CashSummaryCards summary={summary} />

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card
            ref={saleFormRef}
            className="border-primary/8 bg-gradient-to-br from-card via-card to-primary/5 shadow-[var(--shadow-xs)]"
          >
            <CardHeader>
              <CardTitle>Nueva venta</CardTitle>
              <CardDescription>
                Captura minima para registrar la operacion sin quedar bloqueado por el comprobante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!canCreateSale) return;
                  createSaleMutation.mutate({
                    amount: derivedAmount,
                    paymentMethod,
                    receiptKind,
                    customerId: selectedReceiptRemito?.customer_id ?? "__none__",
                    selectedRemitoId,
                    receiptReference,
                    notes,
                  } satisfies CashSaleFormState);
                }}
              >
                <div className="space-y-2">
                  <Label>Comprobante</Label>
                  <Select
                    value={receiptKind}
                    onValueChange={(value) => {
                      setReceiptKind(value as ReceiptKind);
                      setReceiptSearch("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REMITO">Remito</SelectItem>
                      <SelectItem value="FACTURA">Factura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{receiptKind === "REMITO" ? "Remito" : "Factura"}</Label>
                  <Input
                    value={receiptSearch}
                    onChange={(event) => setReceiptSearch(event.target.value)}
                    placeholder="Buscar por remito, factura, cliente o monto"
                  />
                  <Select value={selectedRemitoId} onValueChange={setSelectedRemitoId}>
                    <SelectTrigger>
                      <SelectValue placeholder={receiptKind === "REMITO" ? "Seleccionar remito" : "Seleccionar factura"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{receiptKind === "REMITO" ? "Seleccionar remito" : "Seleccionar factura"}</SelectItem>
                      {filteredReceiptOptions.map((remito) => {
                        const remitoNumber = `${String(remito.point_of_sale).padStart(4, "0")}-${String(remito.document_number ?? 0).padStart(8, "0")}`;
                        const invoiceNumber = remito.external_invoice_number ? `Factura ${remito.external_invoice_number}` : "Sin factura";
                        const amount = Number(remito.total).toFixed(2);
                        return (
                          <SelectItem key={remito.id} value={remito.id}>
                            <div className="flex w-full flex-col leading-tight">
                              <span className="font-medium">{remitoNumber}</span>
                              <span className="text-xs text-muted-foreground">
                                {remito.customer_name} · {invoiceNumber} · ${amount}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Medio de pago</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EFECTIVO_REMITO">Efectivo remito</SelectItem>
                      <SelectItem value="EFECTIVO_FACTURABLE">Efectivo facturable</SelectItem>
                      <SelectItem value="SERVICIOS_REMITO">Servicios / remito</SelectItem>
                      <SelectItem value="POINT">Point</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                      <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observaciones</Label>
                  <Textarea
                    id="notes"
                    placeholder="Cliente, detalle rapido o algo util para revisar la venta despues"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                  />
                </div>

                <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-primary/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Total
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">
                    ${derivedAmount || "0,00"}
                  </div>
                </div>

                {paymentMethod === "SERVICIOS_REMITO" ? (
                  <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
                    Este movimiento impacta en el total del dia, pero no entra en el efectivo a rendir
                    del cierre.
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createSaleMutation.isPending || !canCreateSale}
                >
                  {createSaleMutation.isPending ? "Guardando..." : "Registrar venta"}
                </Button>

                {!canCreateSale ? (
                  <p className="text-sm text-muted-foreground">
                    Tu rol no tiene permiso para registrar ventas.
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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
              <CashHistoryTab
                closuresHistory={historyPagination.pagedItems}
                totalItems={closuresHistory.length}
                onOpenSummary={openClosurePreview}
                page={historyPagination.page}
                totalPages={historyPagination.totalPages}
                onPageChange={setHistoryPage}
                pageSize={historyPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageSizeChange={(value) => setHistoryPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {receiptDialogOpen ? (
        <Suspense fallback={<CashDialogLoader />}>
          <CashReceiptDialog
            open={receiptDialogOpen}
            onOpenChange={setReceiptDialogOpen}
            selectedSale={selectedSale}
            pendingReceiptKind={pendingReceiptKind}
            pendingRemitoId={pendingRemitoId}
            pendingReceiptReference={pendingReceiptReference}
            availableRemitos={pendingReceiptKind === "FACTURA" ? availableFacturableRemitos : availableRemitos}
            saving={attachReceiptMutation.isPending}
            onPendingReceiptKindChange={setPendingReceiptKind}
            onPendingRemitoIdChange={setPendingRemitoId}
            onPendingReceiptReferenceChange={setPendingReceiptReference}
            onSave={(state) => attachReceiptMutation.mutate(state satisfies CashPendingReceiptState)}
            canSave={canAttachCashReceipt(roles)}
          />
        </Suspense>
      ) : null}

      {detailDialogOpen ? (
        <Suspense fallback={<CashDialogLoader />}>
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
        </Suspense>
      ) : null}

      {closurePreviewOpen ? (
        <Suspense fallback={<CashDialogLoader />}>
          <CashClosurePreviewDialog
            open={closurePreviewOpen}
            onOpenChange={setClosurePreviewOpen}
            selectedClosurePreview={selectedClosurePreview}
            selectedClosureSales={selectedClosureSales}
            onPrint={printClosurePreview}
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
