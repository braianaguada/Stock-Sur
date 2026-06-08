import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Printer, ReceiptText, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/data-table/DataTable";
import { AmountDisplay } from "@/components/common/VisualSystem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataCard, FilterBar, PageHeader, StatCard } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_LABEL } from "@/features/cash/constants";
import type { PaymentMethod } from "@/features/cash/types";
import { useBillingSettings } from "@/features/billing/hooks/useBillingData";
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { canCreateBilling } from "@/lib/permissions";
import { getErrorMessage } from "@/lib/errors";
import { currency, formatBusinessDate, formatDocumentNumber, todayBusinessDateInputValue } from "@/lib/formatters";
import { useOccasionalCustomerOperations } from "@/features/customers/occasional/useOccasionalCustomerOperations";
import {
  calculateOccasionalTotals,
  canCreateInvoiceBDraftForOccasionalOperation,
  filterOccasionalOperations,
  type OccasionalClosureStatus,
  type OccasionalFiscalStatus,
  type OccasionalOperation,
} from "@/features/customers/occasional/operations";

const FISCAL_STATUS_LABEL: Record<OccasionalFiscalStatus, string> = {
  PENDING_INVOICE_B: "Pendiente Factura B",
  DRAFT_BILLING: "Borrador fiscal",
  INVOICE_B_AUTHORIZED: "Factura B autorizada",
  CREDIT_NOTE_B_AUTHORIZED: "NC B autorizada",
  REJECTED_BILLING: "Fiscal rechazado",
  CANCELLED: "Anulado",
  UNKNOWN: "Sin estado fiscal",
};

const CLOSURE_STATUS_LABEL: Record<OccasionalClosureStatus, string> = {
  PENDING_CLOSURE: "Pendiente cierre",
  IN_CLOSED_CASH: "En caja cerrada",
  WITHOUT_CASH_SALE: "Sin venta de caja",
};

const FISCAL_BADGE_CLASS: Record<OccasionalFiscalStatus, string> = {
  PENDING_INVOICE_B: "border-amber-200 bg-amber-50 text-amber-700",
  DRAFT_BILLING: "border-sky-200 bg-sky-50 text-sky-700",
  INVOICE_B_AUTHORIZED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CREDIT_NOTE_B_AUTHORIZED: "border-violet-200 bg-violet-50 text-violet-700",
  REJECTED_BILLING: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-600",
  UNKNOWN: "border-slate-200 bg-slate-50 text-slate-600",
};

const PAYMENT_FILTERS: Array<PaymentMethod | "ALL"> = [
  "ALL",
  "EFECTIVO",
  "EFECTIVO_REMITO",
  "EFECTIVO_FACTURABLE",
  "SERVICIOS_REMITO",
  "POINT",
  "TRANSFERENCIA",
  "CUENTA_CORRIENTE",
];

const FISCAL_FILTERS: Array<OccasionalFiscalStatus | "ALL"> = [
  "ALL",
  "PENDING_INVOICE_B",
  "DRAFT_BILLING",
  "INVOICE_B_AUTHORIZED",
  "CREDIT_NOTE_B_AUTHORIZED",
  "REJECTED_BILLING",
  "CANCELLED",
  "UNKNOWN",
];

const CLOSURE_FILTERS: Array<OccasionalClosureStatus | "ALL"> = [
  "ALL",
  "PENDING_CLOSURE",
  "IN_CLOSED_CASH",
  "WITHOUT_CASH_SALE",
];

function Money({ value }: { value: number }) {
  return <AmountDisplay value={value} size="sm" className="text-right" />;
}

export default function OccasionalCustomerPage() {
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const today = todayBusinessDateInputValue();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "ALL">("ALL");
  const [fiscalStatus, setFiscalStatus] = useState<OccasionalFiscalStatus | "ALL">("ALL");
  const [closureStatus, setClosureStatus] = useState<OccasionalClosureStatus | "ALL">("ALL");
  const [draftOperation, setDraftOperation] = useState<OccasionalOperation | null>(null);

  const billingAccessContext = { companyRoleCodes, companyPermissionCodes };
  const canCreateBillingDraft = canCreateBilling(roles, billingAccessContext);
  const settingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const billingEnabled = Boolean(settingsQuery.data?.is_enabled);
  const environment = settingsQuery.data?.environment ?? "sin configurar";
  const operationsQuery = useOccasionalCustomerOperations(currentCompany?.id ?? null, from, to);
  const { createBillingDraftMutation } = useBillingActions({ companyId: currentCompany?.id ?? null, businessDate: from === to ? from : undefined });

  const filteredOperations = useMemo(
    () => filterOccasionalOperations(operationsQuery.operations, { search, paymentMethod, fiscalStatus, closureStatus }),
    [closureStatus, fiscalStatus, operationsQuery.operations, paymentMethod, search],
  );
  const totals = useMemo(() => calculateOccasionalTotals(filteredOperations), [filteredOperations]);

  const columns = useMemo<ColumnDef<OccasionalOperation, unknown>[]>(() => [
    {
      accessorKey: "date",
      header: () => "Fecha",
      cell: ({ row }) => <span className="font-mono text-xs">{formatBusinessDate(row.original.date)}</span>,
      meta: { className: "w-[92px]" },
    },
    {
      id: "remito",
      header: () => "Remito",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{formatDocumentNumber(row.original.remito.point_of_sale, row.original.remito.document_number)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{row.original.remito.doc_type}</p>
        </div>
      ),
      meta: { className: "w-[150px]" },
    },
    {
      id: "sale",
      header: () => "Caja",
      cell: ({ row }) => row.original.sale ? (
        <div className="min-w-0 text-sm">
          <p>{PAYMENT_LABEL[row.original.sale.payment_method]}</p>
          <p className="mt-1 text-xs text-muted-foreground">{CLOSURE_STATUS_LABEL[row.original.closureStatus]}</p>
        </div>
      ) : <span className="text-sm text-muted-foreground">Sin venta asociada</span>,
      meta: { className: "w-[170px]" },
    },
    {
      id: "fiscal",
      header: () => "Fiscal B",
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant="outline" className={FISCAL_BADGE_CLASS[row.original.fiscalStatus]}>
            {FISCAL_STATUS_LABEL[row.original.fiscalStatus]}
          </Badge>
          {row.original.invoiceB?.voucher_full_number ? <p className="font-mono text-xs text-muted-foreground">{row.original.invoiceB.voucher_full_number}</p> : null}
          {row.original.creditNoteB?.voucher_full_number ? <p className="font-mono text-xs text-muted-foreground">NC {row.original.creditNoteB.voucher_full_number}</p> : null}
        </div>
      ),
      meta: { className: "w-[190px]" },
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Importe</div>,
      cell: ({ row }) => <Money value={row.original.amount} />,
      meta: { className: "w-[132px]" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => {
        const operation = row.original;
        const canCreateDraft = canCreateInvoiceBDraftForOccasionalOperation({
          operation,
          billingEnabled,
          canCreateBilling: canCreateBillingDraft,
        });
        return (
          <div className="flex items-center justify-end gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Ver remitos" onClick={() => navigate("/documents")}>
              <FileText className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Ver caja" onClick={() => navigate("/cash")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            {operation.invoiceB ? (
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Imprimir Factura B" onClick={() => window.open(`/print/billing/${operation.invoiceB?.id}`, "_blank", "noopener,noreferrer")}>
                <Printer className="h-4 w-4" />
              </Button>
            ) : null}
            {canCreateDraft ? (
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Crear borrador Factura B" onClick={() => setDraftOperation(operation)} disabled={createBillingDraftMutation.isPending}>
                <ReceiptText className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: { className: "w-[132px]" },
    },
  ], [billingEnabled, canCreateBillingDraft, createBillingDraftMutation.isPending, navigate]);

  const createDraft = () => {
    if (!draftOperation?.sale) return;
    createBillingDraftMutation.mutate(
      { cashSaleId: draftOperation.sale.id, invoiceType: "FACTURA_B" },
      {
        onSuccess: () => {
          setDraftOperation(null);
          toast({ title: "Borrador Factura B creado", description: "El comprobante quedo disponible en Facturacion." });
          navigate("/billing");
        },
        onError: (error) => {
          toast({ title: "No se pudo crear el borrador", description: getErrorMessage(error), variant: "destructive" });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="page-shell">
        <PageHeader
          eyebrow="Cliente de sistema"
          title="Cliente ocasional / Consumidor Final"
          description="Seguimiento operativo read-only de remitos, caja, Factura B y NC B sin cliente registrado."
          meta={(
            <>
              <Badge variant="secondary">Sistema</Badge>
              <Badge variant="secondary">No editable</Badge>
              <Badge variant="outline">customer_id = null</Badge>
              <Badge variant="outline">Factura A sin autorizacion</Badge>
              <Badge variant="outline">NC A no implementada</Badge>
              <Badge variant={environment === "dev" ? "secondary" : "destructive"}>Billing {environment}</Badge>
            </>
          )}
          actions={(
            <Button variant="outline" asChild>
              <Link to="/customers"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link>
            </Button>
          )}
        />

        {!currentCompany ? (
          <div className="surface-card-muted max-w-2xl px-5 py-4 text-sm text-foreground">
            Selecciona una empresa para ver operaciones ocasionales.
          </div>
        ) : null}

        <FilterBar>
          <div className="grid w-full gap-3 md:grid-cols-[150px_150px_minmax(220px,1fr)_190px_190px_190px]">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar remito, cliente, comprobante..." value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_FILTERS.map((value) => <SelectItem key={value} value={value}>{value === "ALL" ? "Todos los pagos" : PAYMENT_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fiscalStatus} onValueChange={(value) => setFiscalStatus(value as OccasionalFiscalStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FISCAL_FILTERS.map((value) => <SelectItem key={value} value={value}>{value === "ALL" ? "Todos fiscal" : FISCAL_STATUS_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={closureStatus} onValueChange={(value) => setClosureStatus(value as OccasionalClosureStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLOSURE_FILTERS.map((value) => <SelectItem key={value} value={value}>{value === "ALL" ? "Todos cierre" : CLOSURE_STATUS_LABEL[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Operaciones" value={totals.operationsCount} hint={`${totals.cashSalesCount} ventas de caja`} />
          <StatCard label="Pendiente Factura B" value={currency.format(totals.pendingInvoiceBTotal)} hint={`${totals.pendingInvoiceBCount} pendientes, ${totals.draftBillingCount} borradores`} tone={totals.pendingInvoiceBTotal > 0 ? "warning" : "success"} />
          <StatCard label="Factura B autorizada" value={currency.format(totals.authorizedInvoiceBTotal)} hint={`${totals.invoiceBAuthorizedCount} comprobantes`} tone="success" />
          <StatCard label="NC B autorizada" value={currency.format(totals.authorizedCreditNoteBTotal)} hint={`Neto fiscal ${currency.format(totals.netFiscalTotal)}`} tone={totals.authorizedCreditNoteBTotal > 0 ? "info" : "default"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <DataCard>
            <DataTable
              columns={columns}
              data={filteredOperations}
              isLoading={operationsQuery.isLoading}
              loadingMessage="Cargando operaciones ocasionales..."
              emptyMessage="Sin operaciones ocasionales para el periodo seleccionado."
              className="table-fixed"
            />
          </DataCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cierre diario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                {Object.entries(totals.byPaymentMethod).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{method === "SIN_VENTA" ? "Sin venta" : PAYMENT_LABEL[method as PaymentMethod]}</span>
                    <span className="font-semibold">{currency.format(amount ?? 0)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4">
                <p className="font-semibold">Advertencias</p>
                <ul className="mt-2 space-y-2 text-muted-foreground">
                  <li>Medios electronicos pendientes de Factura B: {totals.electronicPendingCount}</li>
                  <li>Comprobantes fiscales rechazados: {totals.rejectedBillingCount}</li>
                  <li>NC A: no implementada.</li>
                  <li>Factura A: sin accion de autorizacion desde esta vista.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!draftOperation} onOpenChange={(open) => { if (!open) setDraftOperation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear borrador Factura B</AlertDialogTitle>
            <AlertDialogDescription>
              Se creara un borrador fiscal B en homologacion para el remito {draftOperation ? formatDocumentNumber(draftOperation.remito.point_of_sale, draftOperation.remito.document_number) : ""}. No autoriza comprobantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={createDraft} disabled={createBillingDraftMutation.isPending}>
              Crear borrador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
