import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { getErrorMessage } from "@/lib/errors";
import { canAttachCashReceipt, canCancelCashExpense, canCancelCashSale, canCloseCash, canCreateBilling, canCreateCashExpense, canCreateCashSale } from "@/lib/permissions";
import { openPrintWindow } from "@/lib/print";
import { currentTimeInBuenosAires } from "@/lib/formatters";
import { ArrowLeft, History, Plus } from "lucide-react";
import { CashClosureTab } from "@/features/cash/components/CashClosureTab";
import { CashExpensesTab } from "@/features/cash/components/CashExpensesTab";
import { CashHistoryTab } from "@/features/cash/components/CashHistoryTab";
import { CashSalesTab } from "@/features/cash/components/CashSalesTab";
import { CashOverviewPanel } from "@/features/cash/components/CashSummaryCards";
import { useCashData } from "@/features/cash/hooks/useCashData";
import { useCashMutations } from "@/features/cash/hooks/useCashMutations";
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { useActiveBillingSourceIds, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import { canUseCustomerForInvoiceA } from "@/features/customers/fiscal";
import { OCCASIONAL_CUSTOMER_DISPLAY_NAME } from "@/features/documents/utils";
import { AmountDisplay } from "@/components/common/VisualSystem";
import type { BillingInvoiceType } from "@/features/billing/types";
import type {
  CashExpenseFormState,
  CashExpenseRow,
  CashPendingReceiptState,
  CashSaleFormState,
  CashMovementRow,
  CashSaleRow,
  PaymentMethod,
  ReceiptKind,
  SituationFilter,
} from "@/features/cash/types";
import {
  buildCashClosurePrintHtml,
  buildReceiptSearchText,
  formatRemitoOptionLabel,
  normalizeReceiptSearch,
  shouldAutoCloseCashClosure,
  todayDateInputValue,
} from "@/features/cash/utils";

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
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
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
  const [pendingReceiptKind, setPendingReceiptKind] = useState<"REMITO" | "FACTURA">("REMITO");
  const [pendingRemitoId, setPendingRemitoId] = useState<string>("__none__");
  const [pendingReceiptReference, setPendingReceiptReference] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<CashMovementRow | null>(null);
  const [closurePreviewOpen, setClosurePreviewOpen] = useState(false);
  const [selectedClosureId, setSelectedClosureId] = useState<string | null>(null);
  const [closeNotes, setCloseNotes] = useState("");
  const [isCloseNotesDirty, setIsCloseNotesDirty] = useState(false);
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("TODAS");
  const [expenseForm, setExpenseForm] = useState<CashExpenseFormState>({
    businessDate,
    category: "OTROS",
    description: "",
    amount: "",
    expenseKind: "CAJA",
    hasReceipt: false,
    receiptReference: "",
    notes: "",
  });
  const [tab, setTab] = useState("day");
  const [secondaryView, setSecondaryView] = useState<"history" | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const saleFormRef = useRef<HTMLDivElement | null>(null);
  const autoCloseTriggeredRef = useRef<string | null>(null);

  const {
    customers,
    remitos,
    closure,
    closureLoading,
    closureError,
    salesLoading,
    expenses,
    expensesLoading,
    salesError,
    expensesError,
    remitosError,
    linkedDocument,
    linkedDocumentLines,
    linkedDocumentEvents,
    closuresHistory,
    selectedClosureMovementsForPreview,
    summary,
    pendingSales,
    effectiveClosure,
    hasClosedClosureForDay,
    availableRemitos,
    availableFacturableRemitos,
    availableReturnRemitos,
    unclosedSalesAfterClosure,
    filteredSales,
    selectedClosurePreview,
    usedReceiptReferences,
    refreshCash,
  } = useCashData({
    businessDate,
    detailDocumentId: detailSale?.status === "ANULADA" ? null : detailSale?.document_id ?? null,
    detailReceiptReference: detailSale?.status === "ANULADA" ? null : detailSale?.receipt_reference ?? null,
    selectedClosureId,
    situationFilter,
    currentCompanyId: currentCompany?.id ?? null,
  });
  const remitosById = useMemo(() => new Map(remitos.map((remito) => [remito.id, remito])), [remitos]);
  const billingSettingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const { billedSourceIds } = useActiveBillingSourceIds(currentCompany?.id ?? null);
  const { createBillingDraftMutation } = useBillingActions({
    companyId: currentCompany?.id ?? null,
    businessDate,
  });
  const selectedReceiptRemito = useMemo(
    () => remitosById.get(selectedRemitoId) ?? null,
    [remitosById, selectedRemitoId],
  );
  const derivedAmount = selectedReceiptRemito ? Number(selectedReceiptRemito.total).toFixed(2) : "";
  const derivedDisplayAmount =
    receiptKind === "REMITO_DEVOLUCION" && derivedAmount ? -Number(derivedAmount) : Number(derivedAmount || 0);

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
    if (receiptKind === "REMITO_DEVOLUCION") {
      setPaymentMethod("SERVICIOS_REMITO");
    }
  }, [receiptKind]);

  useEffect(() => {
    if (pendingReceiptKind === "REMITO") {
      setPendingRemitoId("__none__");
    }
  }, [pendingReceiptKind]);

  useEffect(() => {
    setHistoryPage(1);
  }, [closuresHistory.length, historyPageSize]);

  useEffect(() => {
    setExpenseForm((current) => ({ ...current, businessDate }));
  }, [businessDate]);

  useEffect(() => {
    setSalesPage(1);
  }, [businessDate, situationFilter, filteredSales.length, salesPageSize]);

  const resetSaleForm = () => {
    setPaymentMethod("EFECTIVO_REMITO");
    setReceiptKind("REMITO");
    setSelectedRemitoId("__none__");
    setReceiptSearch("");
    setReceiptReference("");
    setNotes("");
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      businessDate,
      category: "OTROS",
      description: "",
      amount: "",
      expenseKind: "CAJA",
      hasReceipt: false,
      receiptReference: "",
      notes: "",
    });
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
    createExpenseMutation,
    attachReceiptMutation,
    cancelSaleMutation,
    cancelExpenseMutation,
    closeClosureMutation,
  } = useCashMutations({
    currentCompanyId: currentCompany?.id ?? null,
    businessDate,
    customers,
    remitos,
    usedReceiptReferences,
    closure,
    closureError,
    closeNotes,
    refreshCash,
    toast,
    onCreateSaleSuccess: resetSaleForm,
    onCreateExpenseSuccess: resetExpenseForm,
    onAttachReceiptSuccess: resetPendingReceiptForm,
  });

  useEffect(() => {
    if (!currentCompany) return;
    if (!closure || closure.status !== "ABIERTO") return;
    const { hour: currentHour, minute: currentMinute } = currentTimeInBuenosAires();
    const result = shouldAutoCloseCashClosure({
      enabled: companySettings.auto_close_cash_enabled,
      configuredTime: companySettings.auto_close_cash_time,
      businessDate,
      todayBusinessDate: todayDateInputValue(),
      currentHour,
      currentMinute,
      closureId: closure.id,
      triggeredKey: autoCloseTriggeredRef.current,
    });

    if (!result.shouldClose) return;
    autoCloseTriggeredRef.current = result.nextTriggeredKey;
    closeClosureMutation.mutate({
      countedCashTotal: Number(closure.expected_cash_to_render ?? 0),
      countedPointTotal: Number(closure.expected_point_sales_total ?? 0),
      countedTransferTotal: Number(closure.expected_transfer_sales_total ?? 0),
      notes: "Cierre automatico por hora maxima configurada",
    });
  }, [businessDate, closure, closeClosureMutation, companySettings.auto_close_cash_enabled, companySettings.auto_close_cash_time, currentCompany]);

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
  const formatCashOptionCustomer = (remito: (typeof availableRemitos)[number]) =>
    remito.customer_name?.trim() ? remito.customer_name.trim() : OCCASIONAL_CUSTOMER_DISPLAY_NAME;
  const remitoOptionLabels = useMemo(
    () =>
      new Map(
        [...availableRemitos, ...availableFacturableRemitos, ...availableReturnRemitos].map((remito) => [
          remito.id,
          formatRemitoOptionLabel(remito),
        ]),
      ),
    [availableFacturableRemitos, availableRemitos, availableReturnRemitos],
  );
  const selectedReceiptOption = selectedReceiptRemito
    ? {
        receiptLabel:
          receiptKind === "FACTURA" && selectedReceiptRemito.external_invoice_number
            ? selectedReceiptRemito.external_invoice_number
            : receiptKind === "REMITO_DEVOLUCION"
              ? `DEV ${String(selectedReceiptRemito.point_of_sale).padStart(4, "0")}-${String(selectedReceiptRemito.document_number ?? 0).padStart(8, "0")}`
            : `${String(selectedReceiptRemito.point_of_sale).padStart(4, "0")}-${String(selectedReceiptRemito.document_number ?? 0).padStart(8, "0")}`,
        customerLabel: formatCashOptionCustomer(selectedReceiptRemito),
        amount: Number(selectedReceiptRemito.total).toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      }
    : null;
  const receiptOptions =
    receiptKind === "REMITO"
      ? availableRemitos
      : receiptKind === "REMITO_DEVOLUCION"
        ? availableReturnRemitos
        : availableFacturableRemitos;
  const filteredReceiptOptions = useMemo(() => {
    const query = normalizeReceiptSearch(receiptSearch);
    if (!query) return receiptOptions;
    return receiptOptions.filter((remito) => {
      const label = remitoOptionLabels.get(remito.id) ?? formatRemitoOptionLabel(remito);
      return buildReceiptSearchText(remito).includes(query) || normalizeReceiptSearch(label).includes(query);
    });
  }, [receiptOptions, remitoOptionLabels, receiptSearch]);

  useEffect(() => {
    if (selectedRemitoId === "__none__") return;
    if (!filteredReceiptOptions.some((remito) => remito.id === selectedRemitoId)) {
      setSelectedRemitoId("__none__");
    }
  }, [filteredReceiptOptions, selectedRemitoId]);
  const historyPagination = usePaginationSlice({
    items: closuresHistory,
    page: historyPage,
    pageSize: historyPageSize,
  });
  const salesPagination = usePaginationSlice({
    items: filteredSales,
    page: salesPage,
    pageSize: salesPageSize,
  });

  const canCreateSale = canCreateCashSale(roles);
  const canCreateExpense = canCreateCashExpense(roles);
  const canCloseCashAction = canCloseCash(roles);
  const canCreateBillingDraft = canCreateBilling(roles, { companyRoleCodes, companyPermissionCodes });
  const canCancelSale = (sale: CashMovementRow) =>
    sale.movement_kind === "SALE" && canCancelCashSale(roles) && !sale.closure_id;
  const canCancelExpense = (expense: CashExpenseRow) => canCancelCashExpense(roles) && !expense.closure_id;
  const canAttachReceipt = (sale: CashMovementRow) =>
    sale.movement_kind === "SALE" && canAttachCashReceipt(roles) && sale.status === "PENDIENTE_COMPROBANTE";

  const openReceiptDialog = (sale: CashMovementRow) => {
    if (!canAttachCashReceipt(roles)) return;
    if (sale.movement_kind !== "SALE") return;
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

  const openSaleDetail = (sale: CashMovementRow) => {
    setDetailSale(sale);
    setDetailDialogOpen(true);
  };

  const getInvoiceAReadiness = (sale: CashMovementRow) => {
    const remito = sale.document_id ? remitosById.get(sale.document_id) : null;
    const customer = remito?.customers
      ? {
          id: remito.customers.id,
          company_id: remito.customers.company_id,
          name: remito.customers.name,
          cuit: remito.customers.cuit,
          email: remito.customers.email,
          phone: remito.customers.phone,
          is_occasional: remito.customers.is_occasional,
        }
      : null;
    const fiscalProfile = remito?.customers?.customer_fiscal_profiles?.[0] ?? null;
    return canUseCustomerForInvoiceA(customer, fiscalProfile);
  };

  const createBillingDraft = (sale: CashMovementRow, invoiceType: BillingInvoiceType = "FACTURA_B") => {
    if (invoiceType === "FACTURA_A") {
      const readiness = getInvoiceAReadiness(sale);
      if (!readiness.allowed) {
        toast({
          title: "Factura A bloqueada",
          description: readiness.reasons.join(" "),
          variant: "destructive",
        });
        return;
      }
    }

    const confirmed = window.confirm(
      invoiceType === "FACTURA_A"
        ? "Se creara un borrador interno Factura A desde esta venta/remito. No se autoriza, no se emite CAE y no se modifica caja, stock ni cuenta corriente."
        : "Se creara un borrador fiscal Factura B a Consumidor Final desde esta venta/remito. No se emitira CAE todavia.",
    );
    if (!confirmed) return;

    createBillingDraftMutation.mutate(
      { cashSaleId: sale.id, invoiceType },
      {
        onSuccess: () => {
          toast({
            title: "Borrador fiscal creado",
            description: invoiceType === "FACTURA_A"
              ? "Se creo una Factura A en preparacion. No tiene CAE ni numero fiscal."
              : "Se creo una Factura B interna en estado borrador. No tiene CAE.",
          });
          window.location.assign("/billing");
        },
        onError: (error) => {
          toast({
            title: "No se pudo crear el borrador fiscal",
            description: getErrorMessage(error),
            variant: "destructive",
          });
        },
      },
    );
  };

  const printClosurePreview = () => {
    if (!selectedClosurePreview) return;

    const win = openPrintWindow(
        buildCashClosurePrintHtml({
          closure: selectedClosurePreview,
          movements: selectedClosureMovementsForPreview,
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

        <section className="border-b border-border/70 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="page-title">Caja</h1>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Caja y cierre diario
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${effectiveClosure?.status === "CERRADO" ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning"}`}>
                  {effectiveClosure?.status === "CERRADO" ? "Cerrada" : "Abierta"}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Control diario de ventas, gastos y cierre.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button
                onClick={() => {
                  setSecondaryView(null);
                  setTab("day");
                  window.requestAnimationFrame(() => {
                    saleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nueva venta
              </Button>
              <Button type="button" variant="outline" onClick={() => setSecondaryView("history")}>
                <History className="mr-2 h-4 w-4" /> Ver historial
              </Button>
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-2 py-1">
                <Label htmlFor="business-date" className="whitespace-nowrap text-xs text-muted-foreground">
                  Fecha operativa
                </Label>
                <Input
                  id="business-date"
                  type="date"
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                  className="h-8 w-[145px] border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(value) => {
            setSecondaryView(null);
            setTab(value);
          }} className="mt-4 w-full">
            <TabsList className="w-auto justify-start">
              <TabsTrigger value="day">Hoy</TabsTrigger>
              <TabsTrigger value="expenses">Gastos</TabsTrigger>
              <TabsTrigger value="closure">Cierre</TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {salesError || expensesError || remitosError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {salesError
              ? getErrorMessage(salesError, "No se pudo cargar Caja.")
              : expensesError
                ? getErrorMessage(expensesError, "No se pudo cargar gastos de Caja.")
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

        <CashOverviewPanel
          summary={summary}
          closureStatus={effectiveClosure?.status}
          movementCount={filteredSales.length}
          pendingCount={pendingSales.length}
        />

        {secondaryView ? (
          <section className="space-y-4">
            <Button type="button" variant="ghost" onClick={() => setSecondaryView(null)} className="w-fit">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver a caja del dia
            </Button>
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
          </section>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setSecondaryView(null);
              setTab(value);
            }}
            className="space-y-4"
          >
            <TabsContent value="day">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                <CashSalesTab
                  filteredSales={salesPagination.pagedItems}
                  salesLoading={salesLoading}
                  situationFilter={situationFilter}
                  onSituationFilterChange={setSituationFilter}
                  effectiveClosure={effectiveClosure}
                  onOpenDetail={openSaleDetail}
                  onCancelSale={(saleId) => {
                    if (!canCancelCashSale(roles)) return;
                    cancelSaleMutation.mutate(saleId);
                  }}
                  canCancelSale={canCancelSale}
                  cancelPending={cancelSaleMutation.isPending}
                  billingEnabled={billingSettingsQuery.billingEnabled}
                  billedSourceIds={billedSourceIds}
                  canCreateBillingDraft={canCreateBillingDraft}
                  onCreateBillingDraft={(sale) => createBillingDraft(sale, "FACTURA_B")}
                  onCreateInvoiceADraft={(sale) => createBillingDraft(sale, "FACTURA_A")}
                  getInvoiceAReadiness={getInvoiceAReadiness}
                  createBillingDraftPending={createBillingDraftMutation.isPending}
                  page={salesPagination.page}
                  totalPages={salesPagination.totalPages}
                  totalItems={filteredSales.length}
                  onPageChange={setSalesPage}
                  pageSize={salesPageSize}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageSizeChange={(value) => setSalesPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
                />

                <Card
                  ref={saleFormRef}
                  className="h-fit border-primary/8 bg-card shadow-[var(--shadow-xs)] xl:sticky xl:top-4"
                >
                  <CardHeader>
                    <CardTitle>{receiptKind === "REMITO_DEVOLUCION" ? "Nueva devolucion" : "Nueva venta"}</CardTitle>
                    <CardDescription>
                      Panel secundario para cargar una operacion sin perder de vista los movimientos del dia.
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
                            setSelectedRemitoId("__none__");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="REMITO">Remito</SelectItem>
                            <SelectItem value="FACTURA">Factura</SelectItem>
                            <SelectItem value="REMITO_DEVOLUCION">Devolucion / Remito devolucion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          {receiptKind === "REMITO"
                            ? "Remito"
                            : receiptKind === "REMITO_DEVOLUCION"
                              ? "Devolucion"
                              : "Factura"}
                        </Label>
                        <Select value={selectedRemitoId} onValueChange={setSelectedRemitoId}>
                          <SelectTrigger className="justify-start">
                            {selectedReceiptOption ? (
                              <div className="grid w-full grid-cols-[132px_minmax(0,1fr)_76px] items-center gap-2 text-left">
                                <span className="min-w-0 whitespace-nowrap font-medium text-left tabular-nums">
                                  {selectedReceiptOption.receiptLabel}
                                </span>
                                <span className="min-w-0 truncate text-left text-xs text-muted-foreground">
                                  {selectedReceiptOption.customerLabel}
                                </span>
                                <span className="min-w-0 truncate text-left text-xs text-muted-foreground tabular-nums">
                                  ${selectedReceiptOption.amount}
                                </span>
                              </div>
                            ) : (
                              <SelectValue
                                placeholder={
                                  receiptKind === "REMITO"
                                    ? "Seleccionar remito"
                                    : receiptKind === "REMITO_DEVOLUCION"
                                      ? "Seleccionar devolucion"
                                      : "Seleccionar factura"
                                }
                              />
                            )}
                          </SelectTrigger>
                          <SelectContent className="max-h-[22rem] overflow-hidden p-0">
                            <div className="border-b border-border/60 p-2">
                              <Input
                                value={receiptSearch}
                                onChange={(event) => setReceiptSearch(event.target.value)}
                                placeholder="Buscar por remito, factura, cliente o monto"
                                autoComplete="off"
                              />
                            </div>
                            <SelectItem value="__none__">
                              {receiptKind === "REMITO"
                                ? "Seleccionar remito"
                                : receiptKind === "REMITO_DEVOLUCION"
                                  ? "Seleccionar devolucion"
                                  : "Seleccionar factura"}
                            </SelectItem>
                            {filteredReceiptOptions.map((remito) => {
                              const remitoNumber = `${String(remito.point_of_sale).padStart(4, "0")}-${String(remito.document_number ?? 0).padStart(8, "0")}`;
                              const receiptLabel =
                                receiptKind === "FACTURA" && remito.external_invoice_number
                                  ? remito.external_invoice_number
                                  : receiptKind === "REMITO_DEVOLUCION"
                                    ? `DEV ${remitoNumber}`
                                  : remitoNumber;
                              const amount = Number(remito.total).toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                              const customerLabel = formatCashOptionCustomer(remito);
                              return (
                                <SelectItem key={remito.id} value={remito.id}>
                                  <div className="grid w-full grid-cols-[132px_minmax(0,1fr)_76px] items-center gap-2 py-0.5 leading-tight text-left">
                                    <span className="min-w-0 whitespace-nowrap font-medium text-left tabular-nums">{receiptLabel}</span>
                                    <span className="min-w-0 truncate text-left text-xs text-muted-foreground">
                                      {receiptKind === "REMITO_DEVOLUCION" && remito.source_document_number_snapshot
                                        ? `${customerLabel} · Origen ${remito.source_document_number_snapshot}`
                                        : customerLabel}
                                    </span>
                                    <span className="min-w-0 truncate text-left text-xs text-muted-foreground tabular-nums">
                                      ${amount}
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
                          disabled={receiptKind === "REMITO_DEVOLUCION"}
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

                      <div className="rounded-2xl border border-border/60 bg-[hsl(var(--panel))]/44 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                          Total a registrar
                        </div>
                        <AmountDisplay
                          value={derivedDisplayAmount}
                          size="lg"
                          className={`mt-1 text-3xl ${derivedDisplayAmount < 0 ? "text-destructive" : ""}`}
                        />
                      </div>

                      {paymentMethod === "SERVICIOS_REMITO" ? (
                        <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
                          {receiptKind === "REMITO_DEVOLUCION"
                            ? "La devolucion se registra como ajuste negativo de Servicios / remito y no toca la caja original."
                            : "Este movimiento impacta en el total del dia, pero no entra en el efectivo a rendir del cierre."}
                        </p>
                      ) : null}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createSaleMutation.isPending || !canCreateSale}
                      >
                        {createSaleMutation.isPending
                          ? "Guardando..."
                          : receiptKind === "REMITO_DEVOLUCION"
                            ? "Registrar devolucion"
                            : "Registrar venta"}
                      </Button>

                      {!canCreateSale ? (
                        <p className="text-sm text-muted-foreground">
                          Tu rol no tiene permiso para registrar ventas.
                        </p>
                      ) : null}
                    </form>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="expenses">
              <CashExpensesTab
                expenses={expenses}
                expensesLoading={expensesLoading}
                form={expenseForm}
                onFormChange={setExpenseForm}
                onSubmit={() => createExpenseMutation.mutate(expenseForm)}
                onCancelExpense={(expenseId) => {
                  if (!canCancelCashExpense(roles)) return;
                  cancelExpenseMutation.mutate(expenseId);
                }}
                canCreateExpense={canCreateExpense}
                canCancelExpense={canCancelExpense}
                createPending={createExpenseMutation.isPending}
                cancelPending={cancelExpenseMutation.isPending}
                hasClosedClosureForDay={hasClosedClosureForDay}
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

          </Tabs>
        )}
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
            selectedClosureMovements={selectedClosureMovementsForPreview}
            onPrint={printClosurePreview}
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}


