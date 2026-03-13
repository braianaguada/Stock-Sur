import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, CircleDollarSign, Landmark, Receipt, Smartphone, ClipboardCheck, FileClock, Eye, Ban, NotebookText } from "lucide-react";

type PaymentMethod = "EFECTIVO" | "POINT" | "TRANSFERENCIA" | "CUENTA_CORRIENTE";
type ReceiptKind = "PENDIENTE" | "REMITO" | "FACTURA";
type SaleStatus = "REGISTRADA" | "PENDIENTE_COMPROBANTE" | "COMPROBANTADA" | "ANULADA";
type ClosureStatus = "ABIERTO" | "CERRADO";

type CustomerOption = {
  id: string;
  name: string;
  cuit: string | null;
};

type RemitoOption = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  status: string;
};

type CashSaleRow = {
  id: string;
  sold_at: string;
  business_date: string;
  amount_total: number;
  payment_method: PaymentMethod;
  receipt_kind: ReceiptKind;
  status: SaleStatus;
  document_id: string | null;
  closure_id: string | null;
  receipt_reference: string | null;
  customer_name_snapshot: string | null;
  notes: string | null;
};

type CashClosureRow = {
  id: string;
  business_date: string;
  status: ClosureStatus;
  expected_cash_sales_total: number;
  expected_point_sales_total: number;
  expected_transfer_sales_total: number;
  expected_account_sales_total: number;
  expected_cash_expenses_total: number;
  expected_sales_total: number;
  expected_cash_to_render: number;
  counted_cash_total: number | null;
  counted_point_total: number | null;
  counted_transfer_total: number | null;
  cash_difference: number | null;
  point_difference: number | null;
  transfer_difference: number | null;
  notes: string | null;
  closed_at: string | null;
};

type CashSummary = {
  efectivo: number;
  point: number;
  transferencia: number;
  cuentaCorriente: number;
  total: number;
  pendientes: number;
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  POINT: "Point",
  TRANSFERENCIA: "Transferencia",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

const RECEIPT_LABEL: Record<ReceiptKind, string> = {
  PENDIENTE: "Definir despues",
  REMITO: "Remito",
  FACTURA: "Factura",
};

const STATUS_LABEL: Record<SaleStatus, string> = {
  REGISTRADA: "Registrada",
  PENDIENTE_COMPROBANTE: "Pendiente",
  COMPROBANTADA: "Comprobantada",
  ANULADA: "Anulada",
};

const STATUS_CLASS: Record<SaleStatus, string> = {
  REGISTRADA: "bg-slate-100 text-slate-700 border-slate-200",
  PENDIENTE_COMPROBANTE: "bg-amber-100 text-amber-700 border-amber-200",
  COMPROBANTADA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ANULADA: "bg-rose-100 text-rose-700 border-rose-200",
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function todayDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "Abierto";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDocumentNumber(pointOfSale: number, documentNumber: number | null) {
  if (documentNumber == null) return "Sin numero";
  return `${String(pointOfSale).padStart(4, "0")}-${String(documentNumber).padStart(8, "0")}`;
}

function formatRemitoOptionLabel(remito: RemitoOption) {
  const number = formatDocumentNumber(remito.point_of_sale, remito.document_number);
  return remito.customer_name ? `${number} - ${remito.customer_name}` : number;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = "message" in error && typeof error.message === "string" ? error.message : null;
    const maybeDetails = "details" in error && typeof error.details === "string" ? error.details : null;
    const maybeHint = "hint" in error && typeof error.hint === "string" ? error.hint : null;
    return [maybeMessage, maybeDetails, maybeHint].filter(Boolean).join(" - ") || fallback;
  }
  return fallback;
}

export default function CashPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
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
  const [closeNotes, setCloseNotes] = useState("");
  const [countedCashTotal, setCountedCashTotal] = useState("");
  const [countedPointTotal, setCountedPointTotal] = useState("");
  const [countedTransferTotal, setCountedTransferTotal] = useState("");
  const [closureInputDirty, setClosureInputDirty] = useState({
    cash: false,
    point: false,
    transfer: false,
    notes: false,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["cash-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, cuit")
        .order("name")
        .limit(200);

      if (error) throw error;
      return (data ?? []) as CustomerOption[];
    },
  });

  const { data: sales = [], isLoading, error: salesError, refetch: refetchSales } = useQuery({
    queryKey: ["cash-sales", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, business_date, sold_at, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("business_date", businessDate)
        .order("sold_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  const { data: remitos = [], error: remitosError, refetch: refetchRemitos } = useQuery({
    queryKey: ["cash-remitos", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, customer_id, customer_name, point_of_sale, document_number, issue_date, status")
        .eq("doc_type", "REMITO")
        .eq("status", "EMITIDO")
        .eq("issue_date", businessDate)
        .order("document_number", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as RemitoOption[];
    },
  });

  const { data: closure, isLoading: closureLoading, error: closureError, refetch: refetchClosure } = useQuery({
    queryKey: ["cash-closure", businessDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_cash_closure", { p_business_date: businessDate });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No se encontro el cierre del dia");
      return row as CashClosureRow;
    },
  });

  useEffect(() => {
    if (!closure) return;
    if (!closureInputDirty.cash) {
      setCountedCashTotal(closure.counted_cash_total != null ? String(closure.counted_cash_total) : String(closure.expected_cash_to_render || 0));
    }
    if (!closureInputDirty.point) {
      setCountedPointTotal(closure.counted_point_total != null ? String(closure.counted_point_total) : String(closure.expected_point_sales_total || 0));
    }
    if (!closureInputDirty.transfer) {
      setCountedTransferTotal(closure.counted_transfer_total != null ? String(closure.counted_transfer_total) : String(closure.expected_transfer_sales_total || 0));
    }
    if (!closureInputDirty.notes) {
      setCloseNotes(closure.notes ?? "");
    }
  }, [closure, closureInputDirty]);

  useEffect(() => {
    setClosureInputDirty({
      cash: false,
      point: false,
      transfer: false,
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

  const summary: CashSummary = sales.reduce(
    (acc, sale) => {
      if (sale.status !== "ANULADA") {
        acc.total += Number(sale.amount_total);
        if (sale.payment_method === "EFECTIVO") acc.efectivo += Number(sale.amount_total);
        if (sale.payment_method === "POINT") acc.point += Number(sale.amount_total);
        if (sale.payment_method === "TRANSFERENCIA") acc.transferencia += Number(sale.amount_total);
        if (sale.payment_method === "CUENTA_CORRIENTE") acc.cuentaCorriente += Number(sale.amount_total);
      }
      if (sale.status === "PENDIENTE_COMPROBANTE") acc.pendientes += 1;
      return acc;
    },
    { efectivo: 0, point: 0, transferencia: 0, cuentaCorriente: 0, total: 0, pendientes: 0 },
  );

  const pendingSales = sales.filter((sale) => sale.status === "PENDIENTE_COMPROBANTE");
  const assignedRemitoIds = new Set(
    sales
      .filter((sale) => sale.status !== "ANULADA" && sale.document_id)
      .map((sale) => sale.document_id as string),
  );
  const availableRemitos = remitos.filter((remito) => !assignedRemitoIds.has(remito.id));
  const unclosedSalesAfterClosure = sales.filter((sale) => sale.status !== "ANULADA" && !sale.closure_id);
  const expectedCashToRender = Number(closure?.expected_cash_to_render ?? 0);
  const expectedPointTotal = Number(closure?.expected_point_sales_total ?? 0);
  const expectedTransferTotal = Number(closure?.expected_transfer_sales_total ?? 0);
  const parsedCountedCash = countedCashTotal ? Number(countedCashTotal.replace(",", ".")) : null;
  const parsedCountedPoint = countedPointTotal ? Number(countedPointTotal.replace(",", ".")) : null;
  const parsedCountedTransfer = countedTransferTotal ? Number(countedTransferTotal.replace(",", ".")) : null;
  const liveCashDifference = parsedCountedCash != null && Number.isFinite(parsedCountedCash) ? parsedCountedCash - expectedCashToRender : null;
  const livePointDifference = parsedCountedPoint != null && Number.isFinite(parsedCountedPoint) ? parsedCountedPoint - expectedPointTotal : null;
  const liveTransferDifference = parsedCountedTransfer != null && Number.isFinite(parsedCountedTransfer) ? parsedCountedTransfer - expectedTransferTotal : null;

  const refreshCash = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cash-sales", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-closure", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-remitos", businessDate] }),
      refetchSales(),
      refetchClosure(),
      refetchRemitos(),
    ]);
  };

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(amount.replace(",", "."));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Ingresa un importe valido");
      }

      if (receiptKind === "REMITO" && selectedRemitoId === "__none__") {
        throw new Error("Selecciona un remito emitido");
      }

      if (receiptKind === "FACTURA" && !receiptReference.trim()) {
        throw new Error("La factura necesita una referencia o numero");
      }

      if (paymentMethod === "CUENTA_CORRIENTE" && customerId === "__none__") {
        throw new Error("La cuenta corriente requiere cliente");
      }

      const selectedCustomer = customers.find((customer) => customer.id === customerId);
      const selectedRemito = remitos.find((remito) => remito.id === selectedRemitoId);

      const payload = {
        business_date: businessDate,
        amount_total: parsedAmount,
        payment_method: paymentMethod,
        receipt_kind: receiptKind,
        customer_id: customerId === "__none__" ? selectedRemito?.customer_id ?? null : customerId,
        customer_name_snapshot: selectedCustomer?.name ?? selectedRemito?.customer_name ?? "Consumidor final",
        document_id: receiptKind === "REMITO" ? selectedRemito?.id ?? null : null,
        receipt_reference:
          receiptKind === "PENDIENTE"
            ? null
            : receiptKind === "REMITO"
              ? formatDocumentNumber(selectedRemito?.point_of_sale ?? 0, selectedRemito?.document_number ?? null)
              : receiptReference.trim() || null,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from("cash_sales").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshCash();
      setAmount("");
      setPaymentMethod("EFECTIVO");
      setReceiptKind("PENDIENTE");
      setCustomerId("__none__");
      setSelectedRemitoId("__none__");
      setReceiptReference("");
      setNotes("");
      toast({ title: "Venta registrada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo registrar la venta",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const attachReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale) throw new Error("Selecciona una venta pendiente");
      if (pendingReceiptKind === "PENDIENTE") throw new Error("Debes elegir remito o factura");
      if (pendingReceiptKind === "REMITO" && pendingRemitoId === "__none__") {
        throw new Error("Selecciona un remito emitido");
      }
      if (pendingReceiptKind === "FACTURA" && !pendingReceiptReference.trim()) {
        throw new Error("Debes ingresar la referencia de la factura");
      }

      const selectedRemito = remitos.find((remito) => remito.id === pendingRemitoId);

      const { error } = await supabase.rpc("attach_cash_sale_receipt", {
        p_sale_id: selectedSale.id,
        p_receipt_kind: pendingReceiptKind,
        p_document_id: pendingReceiptKind === "REMITO" ? selectedRemito?.id ?? null : null,
        p_receipt_reference:
          pendingReceiptKind === "REMITO"
            ? formatDocumentNumber(selectedRemito?.point_of_sale ?? 0, selectedRemito?.document_number ?? null)
            : pendingReceiptReference.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refreshCash();
      setReceiptDialogOpen(false);
      setSelectedSale(null);
      setPendingReceiptKind("REMITO");
      setPendingRemitoId("__none__");
      setPendingReceiptReference("");
      toast({ title: "Comprobante asociado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo asociar el comprobante",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const cancelSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("cancel_cash_sale", { p_sale_id: saleId, p_reason: "Venta anulada desde Caja" });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshCash();
      toast({ title: "Venta anulada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo anular la venta",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const closeClosureMutation = useMutation({
    mutationFn: async () => {
      if (closureError instanceof Error) throw closureError;
      if (!closure) throw new Error("No se encontro el cierre del dia");

      const parsedCash = Number(countedCashTotal.replace(",", "."));
      const parsedPoint = Number(countedPointTotal.replace(",", "."));
      const parsedTransfer = Number(countedTransferTotal.replace(",", "."));

      if (!Number.isFinite(parsedCash)) throw new Error("Ingresa un efectivo contado valido");
      if (countedPointTotal && !Number.isFinite(parsedPoint)) throw new Error("Ingresa un total de Point valido");
      if (countedTransferTotal && !Number.isFinite(parsedTransfer)) throw new Error("Ingresa un total de transferencias valido");

      const { error } = await supabase.rpc("close_cash_closure", {
        p_closure_id: closure.id,
        p_counted_cash_total: parsedCash,
        p_counted_point_total: countedPointTotal ? parsedPoint : null,
        p_counted_transfer_total: countedTransferTotal ? parsedTransfer : null,
        p_notes: closeNotes.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refreshCash();
      toast({ title: "Caja cerrada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo cerrar la caja",
        description: getErrorMessage(error, "Error desconocido"),
        variant: "destructive",
      });
    },
  });

  const openReceiptDialog = (sale: CashSaleRow) => {
    setSelectedSale(sale);
    setPendingReceiptKind("REMITO");
    setPendingRemitoId("__none__");
    setPendingReceiptReference("");
    setReceiptDialogOpen(true);
  };

  const canCancelSale = (sale: CashSaleRow) => !(sale.closure_id && closure?.status === "CERRADO");
  const canAttachReceipt = (sale: CashSaleRow) => sale.status === "PENDIENTE_COMPROBANTE";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
            <p className="text-muted-foreground">Carga rapida, pendientes de comprobante y cierre diario en una sola vista.</p>
          </div>
          <div className="w-full md:w-[220px]">
            <Label htmlFor="business-date">Fecha operativa</Label>
            <Input id="business-date" type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
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

        {closure?.status === "CERRADO" && unclosedSalesAfterClosure.length > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Hay {unclosedSalesAfterClosure.length} movimiento{unclosedSalesAfterClosure.length === 1 ? "" : "s"} posterior{unclosedSalesAfterClosure.length === 1 ? "" : "es"} al cierre. No forman parte de la caja ya cerrada.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-emerald-300 bg-emerald-100">
            <CardHeader className="pb-3">
              <CardDescription>Efectivo</CardDescription>
              <CardTitle className="flex items-center gap-2 text-emerald-900"><Banknote className="h-4 w-4" /> {currency.format(summary.efectivo)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-sky-300 bg-sky-100">
            <CardHeader className="pb-3">
              <CardDescription>Point</CardDescription>
              <CardTitle className="flex items-center gap-2 text-sky-900"><Smartphone className="h-4 w-4" /> {currency.format(summary.point)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-violet-300 bg-violet-100">
            <CardHeader className="pb-3">
              <CardDescription>Transferencias</CardDescription>
              <CardTitle className="flex items-center gap-2 text-violet-900"><Landmark className="h-4 w-4" /> {currency.format(summary.transferencia)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-amber-300 bg-amber-100">
            <CardHeader className="pb-3">
              <CardDescription>Cuenta corriente</CardDescription>
              <CardTitle className="flex items-center gap-2 text-amber-900"><Receipt className="h-4 w-4" /> {currency.format(summary.cuentaCorriente)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-300 bg-slate-100">
            <CardHeader className="pb-3">
              <CardDescription>Total del dia</CardDescription>
              <CardTitle className="flex items-center gap-2 text-slate-900"><CircleDollarSign className="h-4 w-4" /> {currency.format(summary.total)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">{summary.pendientes} pendientes de comprobante</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="border-primary/10 shadow-sm">
            <CardHeader>
              <CardTitle>Nueva venta</CardTitle>
              <CardDescription>Captura minima para registrar la operacion sin quedar bloqueado por el comprobante.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createSaleMutation.mutate(); }}>
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="day">Caja del dia</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="closure">Cierre diario</TabsTrigger>
            </TabsList>

            <TabsContent value="day">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Movimientos del dia</CardTitle>
                    <CardDescription>Vista rapida para controlar lo cargado y detectar pendientes antes del cierre.</CardDescription>
                  </div>
                  <Badge variant="outline" className="w-fit">{sales.length} registros</Badge>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Comprobante</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-[120px] text-right">Acciones</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando ventas...</TableCell></TableRow>
                        ) : sales.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Todavia no hay ventas registradas para esta fecha.</TableCell></TableRow>
                        ) : (
                          sales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-mono text-xs">{formatTime(sale.sold_at)}</TableCell>
                              <TableCell>
                                <div className="max-w-[220px]">
                                  <p className="truncate text-sm font-medium">{sale.customer_name_snapshot ?? "Consumidor final"}</p>
                                </div>
                              </TableCell>
                              <TableCell>{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <p>{RECEIPT_LABEL[sale.receipt_kind]}</p>
                                  {sale.receipt_reference ? <p className="font-mono text-xs text-muted-foreground">{sale.receipt_reference}</p> : null}
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className={STATUS_CLASS[sale.status]}>{STATUS_LABEL[sale.status]}</Badge></TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setDetailSale(sale);
                                      setDetailDialogOpen(true);
                                    }}
                                  >
                                    <NotebookText className="h-4 w-4" />
                                  </Button>
                                  {sale.status !== "ANULADA" ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive"
                                      onClick={() => cancelSaleMutation.mutate(sale.id)}
                                      disabled={cancelSaleMutation.isPending || !canCancelSale(sale)}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className="font-semibold">{currency.format(Number(sale.amount_total))}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileClock className="h-4 w-4" /> Pendientes de comprobante</CardTitle>
                  <CardDescription>Ventas registradas que ya impactan en caja pero todavia no tienen remito o factura asignada.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                          <TableHead className="w-[220px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingSales.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No hay pendientes para esta fecha.</TableCell></TableRow>
                        ) : (
                          pendingSales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-mono text-xs">{formatTime(sale.sold_at)}</TableCell>
                              <TableCell>{sale.customer_name_snapshot ?? "Consumidor final"}</TableCell>
                              <TableCell>{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                              <TableCell className="text-right font-semibold">{currency.format(Number(sale.amount_total))}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button type="button" size="icon" variant="outline" onClick={() => openReceiptDialog(sale)} disabled={!canAttachReceipt(sale)}>
                                    <ClipboardCheck className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => cancelSaleMutation.mutate(sale.id)}
                                    disabled={cancelSaleMutation.isPending || !canCancelSale(sale)}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      setDetailSale(sale);
                                      setDetailDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="closure">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Cierre diario</CardTitle>
                    <CardDescription>Comparacion entre lo esperado por sistema y lo contado al final de la jornada.</CardDescription>
                  </div>
                  <Badge variant="outline" className={closure?.status === "CERRADO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {closure?.status === "CERRADO" ? "Cerrado" : "Abierto"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  {closureError ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {getErrorMessage(closureError, "No se pudo cargar el cierre diario.")}
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Efectivo a rendir</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(closure?.expected_cash_to_render ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Point esperado</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(closure?.expected_point_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Transferencias esperadas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(closure?.expected_transfer_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Total ventas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(closure?.expected_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="counted-cash">Efectivo contado</Label>
                        <Input
                          id="counted-cash"
                          inputMode="decimal"
                          value={countedCashTotal}
                          onChange={(event) => {
                            setClosureInputDirty((current) => ({ ...current, cash: true }));
                            setCountedCashTotal(event.target.value);
                          }}
                          disabled={closure?.status === "CERRADO"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="counted-point">Point contado</Label>
                        <Input
                          id="counted-point"
                          inputMode="decimal"
                          value={countedPointTotal}
                          onChange={(event) => {
                            setClosureInputDirty((current) => ({ ...current, point: true }));
                            setCountedPointTotal(event.target.value);
                          }}
                          disabled={closure?.status === "CERRADO"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="counted-transfer">Transferencias contadas</Label>
                        <Input
                          id="counted-transfer"
                          inputMode="decimal"
                          value={countedTransferTotal}
                          onChange={(event) => {
                            setClosureInputDirty((current) => ({ ...current, transfer: true }));
                            setCountedTransferTotal(event.target.value);
                          }}
                          disabled={closure?.status === "CERRADO"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="close-notes">Observaciones del cierre</Label>
                        <Textarea
                          id="close-notes"
                          rows={5}
                          value={closeNotes}
                          onChange={(event) => {
                            setClosureInputDirty((current) => ({ ...current, notes: true }));
                            setCloseNotes(event.target.value);
                          }}
                          disabled={closure?.status === "CERRADO"}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resultado</h3>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Efectivo esperado</span>
                          <span className="font-semibold">{currency.format(Number(closure?.expected_cash_to_render ?? 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Diferencia efectivo</span>
                          <span className="font-semibold">{currency.format(Number(liveCashDifference ?? 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Diferencia Point</span>
                          <span className="font-semibold">{currency.format(Number(livePointDifference ?? 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Diferencia transferencias</span>
                          <span className="font-semibold">{currency.format(Number(liveTransferDifference ?? 0))}</span>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-xs text-muted-foreground">Estado del cierre: {closure?.status === "CERRADO" ? `cerrado el ${formatDateTime(closure?.closed_at ?? null)}` : "todavia abierto"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => closeClosureMutation.mutate()} disabled={closureLoading || closeClosureMutation.isPending || closure?.status === "CERRADO" || Boolean(closureError)}>
                      {closeClosureMutation.isPending ? "Cerrando..." : "Cerrar caja"}
                    </Button>
                    <Button variant="outline" onClick={() => void refreshCash()}>
                      Recalcular
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setClosureInputDirty({ cash: false, point: false, transfer: false, notes: false });
                        if (closure) {
                          setCountedCashTotal(String(closure.counted_cash_total ?? closure.expected_cash_to_render ?? 0));
                          setCountedPointTotal(String(closure.counted_point_total ?? closure.expected_point_sales_total ?? 0));
                          setCountedTransferTotal(String(closure.counted_transfer_total ?? closure.expected_transfer_sales_total ?? 0));
                          setCloseNotes(closure.notes ?? "");
                        }
                      }}
                      disabled={closure?.status === "CERRADO"}
                    >
                      Usar valores del sistema
                    </Button>
                    {closure?.status === "CERRADO" ? <p className="text-sm text-muted-foreground">El cierre ya esta bloqueado. Solo queda disponible para consulta.</p> : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar comprobante</DialogTitle>
            <DialogDescription>La venta ya cuenta en caja. Desde aca solo completas el comprobante faltante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedSale?.customer_name_snapshot ?? "Consumidor final"}</p>
              <p className="text-muted-foreground">{selectedSale ? `${formatTime(selectedSale.sold_at)} · ${currency.format(Number(selectedSale.amount_total))}` : ""}</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de comprobante</Label>
              <Select value={pendingReceiptKind} onValueChange={(value) => setPendingReceiptKind(value as ReceiptKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REMITO">Remito</SelectItem>
                  <SelectItem value="FACTURA">Factura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pendingReceiptKind === "REMITO" && (
              <div className="space-y-2">
                <Label>Remito emitido</Label>
                <Select value={pendingRemitoId} onValueChange={setPendingRemitoId}>
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
            {pendingReceiptKind === "FACTURA" && (
              <div className="space-y-2">
                <Label htmlFor="pending-receipt-reference">Referencia de factura</Label>
                <Input id="pending-receipt-reference" value={pendingReceiptReference} onChange={(event) => setPendingReceiptReference(event.target.value)} placeholder="Ej. 0009-00001782" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => attachReceiptMutation.mutate()} disabled={attachReceiptMutation.isPending}>
              {attachReceiptMutation.isPending ? "Guardando..." : "Guardar comprobante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de venta</DialogTitle>
            <DialogDescription>Vista rapida para revisar la operacion y sus acciones disponibles.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                <p className="mt-1 font-medium">{detailSale?.customer_name_snapshot ?? "Consumidor final"}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Importe</p>
                <p className="mt-1 font-medium">{detailSale ? currency.format(Number(detailSale.amount_total)) : "-"}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pago</p>
                <p className="mt-1 font-medium">{detailSale ? PAYMENT_LABEL[detailSale.payment_method] : "-"}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comprobante</p>
                <p className="mt-1 font-medium">{detailSale ? RECEIPT_LABEL[detailSale.receipt_kind] : "-"}</p>
                {detailSale?.receipt_reference ? <p className="font-mono text-xs text-muted-foreground">{detailSale.receipt_reference}</p> : null}
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
                <p className="mt-1 font-medium">{detailSale ? STATUS_LABEL[detailSale.status] : "-"}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cierre</p>
                <p className="mt-1 font-medium">{detailSale?.closure_id ? "Incluida en cierre" : "Sin cerrar"}</p>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 leading-6">
              {detailSale?.notes ?? "Sin observaciones"}
            </div>
          </div>
          <DialogFooter>
            {detailSale && canAttachReceipt(detailSale) ? (
              <Button
                variant="outline"
                onClick={() => {
                  setDetailDialogOpen(false);
                  openReceiptDialog(detailSale);
                }}
              >
                Asignar comprobante
              </Button>
            ) : null}
            {detailSale && detailSale.status !== "ANULADA" ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => cancelSaleMutation.mutate(detailSale.id)}
                disabled={cancelSaleMutation.isPending || !canCancelSale(detailSale)}
              >
                Anular
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
