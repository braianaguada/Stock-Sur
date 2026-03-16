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
import { useCompanyBrand } from "@/contexts/company-brand-context";

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

type DocumentQuickRow = {
  id: string;
  doc_type: "PRESUPUESTO" | "REMITO";
  status: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO";
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_name: string;
  total: number;
  notes: string | null;
};

type DocumentLineQuickRow = {
  id: string;
  line_order: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

type DocumentEventQuickRow = {
  id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

type CashClosureHistoryRow = Pick<
  CashClosureRow,
  | "id"
  | "business_date"
  | "status"
  | "expected_sales_total"
  | "expected_cash_to_render"
  | "expected_point_sales_total"
  | "expected_transfer_sales_total"
  | "counted_cash_total"
  | "counted_point_total"
  | "counted_transfer_total"
  | "cash_difference"
  | "point_difference"
  | "transfer_difference"
  | "notes"
  | "closed_at"
>;

type CashSummary = {
  efectivo: number;
  point: number;
  transferencia: number;
  cuentaCorriente: number;
  total: number;
  pendientes: number;
};

type SituationFilter = "TODAS" | "PENDIENTE_CIERRE" | "EN_CAJA_CERRADA" | "POST_CIERRE" | "ANULADA";

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
  PENDIENTE_COMPROBANTE: "Sin comprobante",
  COMPROBANTADA: "Con comprobante",
  ANULADA: "Anulada",
};

const STATUS_CLASS: Record<SaleStatus, string> = {
  REGISTRADA: "bg-slate-100 text-slate-700 border-slate-200",
  PENDIENTE_COMPROBANTE: "bg-amber-100 text-amber-700 border-amber-200",
  COMPROBANTADA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ANULADA: "bg-rose-100 text-rose-700 border-rose-200",
};

const DOC_STATUS_LABEL: Record<DocumentQuickRow["status"], string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
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

function formatBusinessDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
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

function getClosureSituation(sale: CashSaleRow, hasClosedClosureForDay: boolean) {
  if (sale.status === "ANULADA") {
    return {
      label: "Anulada",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (sale.closure_id) {
    return {
      label: "En caja cerrada",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (hasClosedClosureForDay) {
    return {
      label: "Venta post cierre",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    label: "Pendiente de cierre",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  };
}

function describeDocumentEvent(event: DocumentEventQuickRow) {
  const eventType = event.event_type.toUpperCase();
  if (eventType.includes("EMIT")) return { title: "Documento emitido", tone: "success" as const };
  if (eventType.includes("ANUL")) return { title: "Documento anulado", tone: "danger" as const };
  if (eventType.includes("CRE")) return { title: "Documento creado", tone: "info" as const };
  return { title: event.event_type.replaceAll("_", " "), tone: "neutral" as const };
}

export default function CashPage() {
  const qc = useQueryClient();
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
  const [, setCountedCashTotal] = useState("");
  const [, setCountedPointTotal] = useState("");
  const [, setCountedTransferTotal] = useState("");
  const [closureInputDirty, setClosureInputDirty] = useState({
    cash: false,
    point: false,
    transfer: false,
    notes: false,
  });
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("TODAS");

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

  const { data: linkedDocument } = useQuery({
    queryKey: ["cash-linked-document", detailSale?.document_id],
    enabled: Boolean(detailSale?.document_id),
    queryFn: async () => {
      if (!detailSale?.document_id) return null;
      const { data, error } = await supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_name, total, notes")
        .eq("id", detailSale.document_id)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as DocumentQuickRow | null;
    },
  });

  const { data: linkedDocumentLines = [] } = useQuery({
    queryKey: ["cash-linked-document-lines", detailSale?.document_id],
    enabled: Boolean(detailSale?.document_id),
    queryFn: async () => {
      if (!detailSale?.document_id) return [];
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, line_order, description, quantity, unit, unit_price, line_total")
        .eq("document_id", detailSale.document_id)
        .order("line_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DocumentLineQuickRow[];
    },
  });

  const { data: linkedDocumentEvents = [] } = useQuery({
    queryKey: ["cash-linked-document-events", detailSale?.document_id],
    enabled: Boolean(detailSale?.document_id),
    queryFn: async () => {
      if (!detailSale?.document_id) return [];
      const { data, error } = await supabase
        .from("document_events")
        .select("id, event_type, payload, created_at")
        .eq("document_id", detailSale.document_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DocumentEventQuickRow[];
    },
  });

  const { data: closuresHistory = [] } = useQuery({
    queryKey: ["cash-closures-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_closures")
        .select("id, business_date, status, expected_sales_total, expected_cash_to_render, expected_point_sales_total, expected_transfer_sales_total, counted_cash_total, counted_point_total, counted_transfer_total, cash_difference, point_difference, transfer_difference, notes, closed_at")
        .order("business_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []) as CashClosureHistoryRow[];
    },
  });

  const { data: selectedClosureSales = [] } = useQuery({
    queryKey: ["cash-closure-sales", selectedClosureId],
    enabled: Boolean(selectedClosureId),
    queryFn: async () => {
      if (!selectedClosureId) return [];
      const { data, error } = await supabase
        .from("cash_sales")
        .select("id, sold_at, business_date, amount_total, payment_method, receipt_kind, status, document_id, closure_id, receipt_reference, customer_name_snapshot, notes")
        .eq("closure_id", selectedClosureId)
        .order("sold_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CashSaleRow[];
    },
  });

  useEffect(() => {
    if (!closure) return;
    if (!closureInputDirty.cash) {
      setCountedCashTotal("");
    }
    if (!closureInputDirty.point) {
      setCountedPointTotal("");
    }
    if (!closureInputDirty.transfer) {
      setCountedTransferTotal("");
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
  const closureHistoryForDate = closuresHistory.find((item) => item.business_date === businessDate) ?? null;
  const effectiveClosure = closureHistoryForDate ?? closure ?? null;
  const hasClosedClosureForDay = effectiveClosure?.status === "CERRADO";
  const assignedRemitoIds = new Set(
    sales
      .filter((sale) => sale.status !== "ANULADA" && sale.document_id)
      .map((sale) => sale.document_id as string),
  );
  const availableRemitos = remitos.filter((remito) => !assignedRemitoIds.has(remito.id));
  const unclosedSalesAfterClosure = sales.filter((sale) => sale.status !== "ANULADA" && !sale.closure_id);
  const filteredSales = sales.filter((sale) => {
    if (situationFilter === "TODAS") return true;
    if (situationFilter === "ANULADA") return sale.status === "ANULADA";
    const situation = getClosureSituation(sale, hasClosedClosureForDay).label;
    if (situationFilter === "PENDIENTE_CIERRE") return situation === "Pendiente de cierre";
    if (situationFilter === "EN_CAJA_CERRADA") return situation === "En caja cerrada";
    if (situationFilter === "POST_CIERRE") return situation === "Venta post cierre";
    return true;
  });
  const refreshCash = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cash-sales", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-closure", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-remitos", businessDate] }),
      qc.invalidateQueries({ queryKey: ["cash-closures-history"] }),
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

      const { error } = await supabase.rpc("close_cash_closure", {
        p_closure_id: closure.id,
        p_counted_cash_total: null,
        p_counted_point_total: null,
        p_counted_transfer_total: null,
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

  const canCancelSale = (sale: CashSaleRow) => !sale.closure_id;
  const canAttachReceipt = (sale: CashSaleRow) => sale.status === "PENDIENTE_COMPROBANTE";
  const selectedClosurePreview = closuresHistory.find((item) => item.id === selectedClosureId) ?? null;

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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="day">Caja del dia</TabsTrigger>
              <TabsTrigger value="pending">Pendientes</TabsTrigger>
              <TabsTrigger value="closure">Cierre diario</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="day">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Movimientos del dia</CardTitle>
                    <CardDescription>Vista rapida para controlar lo cargado y detectar pendientes antes del cierre.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="w-fit">{filteredSales.length} registros</Badge>
                    <Select value={situationFilter} onValueChange={(value) => setSituationFilter(value as SituationFilter)}>
                      <SelectTrigger className="w-[190px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        <SelectItem value="PENDIENTE_CIERRE">Pendiente de cierre</SelectItem>
                        <SelectItem value="EN_CAJA_CERRADA">En caja cerrada</SelectItem>
                        <SelectItem value="POST_CIERRE">Venta post cierre</SelectItem>
                        <SelectItem value="ANULADA">Anuladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[560px] overflow-y-auto rounded-lg border">
                    <Table className="table-fixed">
                      <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                        <TableRow>
                          <TableHead className="w-[78px]">Hora</TableHead>
                          <TableHead className="w-[110px] text-right">Importe</TableHead>
                          <TableHead className="w-[170px]">Cliente</TableHead>
                          <TableHead className="w-[96px]">Pago</TableHead>
                          <TableHead className="w-[160px]">Comprobante</TableHead>
                          <TableHead className="w-[150px]">Situacion</TableHead>
                          <TableHead className="w-[92px] text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando ventas...</TableCell></TableRow>
                        ) : filteredSales.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Todavia no hay ventas registradas para esta fecha.</TableCell></TableRow>
                        ) : (
                          filteredSales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell className="font-mono text-xs">{formatTime(sale.sold_at)}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">{currency.format(Number(sale.amount_total))}</TableCell>
                              <TableCell>
                                <div className="max-w-[160px]">
                                  <p className="truncate text-sm font-medium">{sale.customer_name_snapshot ?? "Consumidor final"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                              <TableCell>
                                <div className="min-w-0 text-sm">
                                  <p className="truncate">{RECEIPT_LABEL[sale.receipt_kind]}</p>
                                  <Badge variant="outline" className={`${STATUS_CLASS[sale.status]} mt-1 max-w-full`}>
                                    {STATUS_LABEL[sale.status]}
                                  </Badge>
                                  {sale.receipt_reference ? <p className="truncate font-mono text-xs text-muted-foreground">{sale.receipt_reference}</p> : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getClosureSituation(sale, hasClosedClosureForDay).className}>
                                  {getClosureSituation(sale, hasClosedClosureForDay).label}
                                </Badge>
                              </TableCell>
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
                  <div className="max-h-[560px] overflow-auto rounded-lg border">
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
                    <CardDescription>Cierre operativo del dia con los totales esperados y el resumen imprimible para control.</CardDescription>
                  </div>
                  <Badge variant="outline" className={effectiveClosure?.status === "CERRADO" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                    {effectiveClosure?.status === "CERRADO" ? "Cerrado" : "Abierto"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  {closureError ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {getErrorMessage(closureError, "No se pudo cargar el cierre diario.")}
                    </div>
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Efectivo a rendir</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_cash_to_render ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Point esperado</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_point_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Transferencias esperadas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_transfer_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                    <Card className="bg-slate-50/80"><CardHeader className="pb-2"><CardDescription>Total ventas</CardDescription><CardTitle className="text-lg">{closureLoading ? "..." : currency.format(Number(effectiveClosure?.expected_sales_total ?? 0))}</CardTitle></CardHeader></Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                        El conteo fisico del efectivo se completa sobre el resumen impreso. Desde esta pantalla solo cerras la caja del sistema y dejas observaciones.
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
                          disabled={effectiveClosure?.status === "CERRADO"}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resumen operativo</h3>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Efectivo esperado</span>
                          <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_cash_to_render ?? 0))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total ventas</span>
                          <span className="font-semibold">{currency.format(Number(effectiveClosure?.expected_sales_total ?? 0))}</span>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-xs text-muted-foreground">Estado del cierre: {effectiveClosure?.status === "CERRADO" ? `cerrado el ${formatDateTime(effectiveClosure.closed_at ?? null)}` : "todavia abierto"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => closeClosureMutation.mutate()} disabled={closureLoading || closeClosureMutation.isPending || effectiveClosure?.status === "CERRADO" || Boolean(closureError)}>
                      {closeClosureMutation.isPending ? "Cerrando..." : "Cerrar caja"}
                    </Button>
                    <Button variant="outline" onClick={() => void refreshCash()}>
                      Recalcular
                    </Button>
                    {effectiveClosure?.status === "CERRADO" && effectiveClosure?.id ? (
                      <Button variant="outline" onClick={() => openClosurePreview(effectiveClosure.id)}>
                        Ver resumen
                      </Button>
                    ) : null}
                    {effectiveClosure?.status === "CERRADO" ? <p className="text-sm text-muted-foreground">El cierre ya esta bloqueado. Solo queda disponible para consulta.</p> : null}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Historial de cierres</CardTitle>
                    <CardDescription>Resumenes diarios guardados para consulta e impresion.</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {closuresHistory.length} registro{closuresHistory.length === 1 ? "" : "s"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {closuresHistory.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Todavia no hay cierres guardados.</div>
                    ) : (
                      closuresHistory.map((historyItem) => (
                        <div key={historyItem.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold">{formatBusinessDate(historyItem.business_date)}</p>
                            <p className="text-sm text-muted-foreground">
                              {historyItem.status === "CERRADO" ? `Cerrado el ${formatDateTime(historyItem.closed_at)}` : "Caja abierta"}
                            </p>
                          </div>
                          <div className="grid gap-2 text-sm md:grid-cols-3 md:text-right">
                            <div>
                              <p className="text-muted-foreground">Ventas</p>
                              <p className="font-semibold">{currency.format(Number(historyItem.expected_sales_total))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Efectivo</p>
                              <p className="font-semibold">{currency.format(Number(historyItem.expected_cash_to_render))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Estado</p>
                              <p className="font-semibold">{historyItem.status === "CERRADO" ? "Cerrado" : "Abierto"}</p>
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => openClosurePreview(historyItem.id)}>
                            Ver resumen
                          </Button>
                        </div>
                      ))
                    )}
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Vista previa del documento</DialogTitle>
            <DialogDescription>Documento asociado a la venta y su trazabilidad.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            {linkedDocument ? (
              <>
                <div className="min-w-0 max-h-[72vh] space-y-4 overflow-y-auto pr-1">
                  <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border bg-gradient-to-br from-white via-white to-emerald-50 p-5">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Remito</Badge>
                          <div>
                            {companySettings.logo_url ? (
                              <img src={companySettings.logo_url} alt={companySettings.app_name} className="h-16 w-auto max-w-[220px] object-contain" />
                            ) : (
                              <p className="text-2xl font-black tracking-[0.12em] text-primary">{companySettings.app_name}</p>
                            )}
                            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {companySettings.document_tagline ?? "Documentacion comercial"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white shadow-sm">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Documento</p>
                          <p className="mt-1 text-lg font-bold">{linkedDocument.doc_type === "REMITO" ? "Remito" : linkedDocument.doc_type}</p>
                          <p className="mt-2 text-xs text-slate-300">{formatDocumentNumber(linkedDocument.point_of_sale, linkedDocument.document_number)}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border bg-white/80 p-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                          <p className="mt-2 font-semibold">{linkedDocument.customer_name ?? "Cliente ocasional"}</p>
                        </div>
                        <div className="rounded-2xl border bg-white/80 p-4">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operacion</p>
                          <p className="mt-2 text-sm"><span className="font-semibold">Fecha:</span> {new Date(linkedDocument.issue_date).toLocaleDateString("es-AR")}</p>
                          <p className="text-sm"><span className="font-semibold">Estado:</span> {DOC_STATUS_LABEL[linkedDocument.status]}</p>
                          <p className="text-sm"><span className="font-semibold">Punto de venta:</span> {String(linkedDocument.point_of_sale).padStart(4, "0")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-3xl border bg-card p-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resumen</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border bg-emerald-50 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total documento</p>
                          <p className="mt-2 text-3xl font-black text-primary">{currency.format(Number(linkedDocument.total))}</p>
                        </div>
                        <div className="rounded-2xl border border-dashed p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                          <p className="mt-2 text-sm text-muted-foreground">{linkedDocument.notes ?? "Sin observaciones cargadas."}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Descripcion</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="text-right">P.Unit.</TableHead>
                          <TableHead className="text-right">Importe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linkedDocumentLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.line_order}</TableCell>
                            <TableCell className="font-medium">{line.description}</TableCell>
                            <TableCell className="text-right">{Number(line.quantity).toLocaleString("es-AR")}</TableCell>
                            <TableCell>{line.unit ?? "un"}</TableCell>
                            <TableCell className="text-right font-mono">{currency.format(Number(line.unit_price))}</TableCell>
                            <TableCell className="text-right font-mono">{currency.format(Number(line.line_total))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <aside className="rounded-3xl border bg-card p-5 lg:max-h-[72vh] lg:overflow-y-auto">
                  <div className="mb-5">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Historial</p>
                    <p className="mt-1 text-sm text-muted-foreground">Linea de tiempo del documento.</p>
                  </div>

                  {linkedDocumentEvents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Todavia no hay eventos registrados para este documento.
                    </div>
                  ) : (
                    <div className="relative pl-7">
                      <div className="absolute bottom-2 left-[11px] top-2 w-px rounded-full bg-gradient-to-b from-blue-200 via-emerald-200 to-slate-200" />
                      <div className="space-y-4">
                        {linkedDocumentEvents.map((event) => {
                          const described = describeDocumentEvent(event);
                          return (
                            <div key={event.id} className="relative">
                              <div className={`absolute left-[-21px] top-5 h-3.5 w-3.5 rounded-full ring-4 ring-white shadow-md ${described.tone === "success" ? "bg-emerald-500" : described.tone === "danger" ? "bg-rose-500" : described.tone === "info" ? "bg-blue-500" : "bg-slate-400"}`} />
                              <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold leading-5 text-slate-900">{described.title}</p>
                                    <p className="mt-1 text-sm leading-5 text-slate-500">{event.event_type.replaceAll("_", " ")}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <Badge variant="outline">{new Date(event.created_at).toLocaleDateString("es-AR")}</Badge>
                                    <p className="mt-2 text-xs text-slate-400">
                                      {new Date(event.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </aside>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                Esta venta todavia no tiene un documento asociado para previsualizar.
              </div>
            )}
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

      <Dialog open={closurePreviewOpen} onOpenChange={setClosurePreviewOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Resumen del cierre</DialogTitle>
            <DialogDescription>Vista previa del cierre diario guardado para control e impresion.</DialogDescription>
          </DialogHeader>
          {selectedClosurePreview ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
              <div className="rounded-3xl border bg-gradient-to-br from-white via-white to-sky-50 p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Cierre diario</p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">
                      {formatBusinessDate(selectedClosurePreview.business_date)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedClosurePreview.status === "CERRADO" ? `Cerrado el ${formatDateTime(selectedClosurePreview.closed_at)}` : "Caja abierta"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white shadow-sm">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Estado</p>
                    <p className="mt-1 text-lg font-bold">{selectedClosurePreview.status === "CERRADO" ? "Cerrado" : "Abierto"}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border bg-white/95 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total ventas</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{currency.format(Number(selectedClosurePreview.expected_sales_total))}</p>
                    <p className="text-sm text-muted-foreground">Movimientos: {selectedClosureSales.length}</p>
                  </div>
                  <div className="rounded-2xl border bg-emerald-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo esperado</p>
                    <p className="mt-2 text-xl font-bold text-emerald-700">{currency.format(Number(selectedClosurePreview.expected_cash_to_render))}</p>
                  </div>
                  <div className="rounded-2xl border bg-sky-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Point esperado</p>
                    <p className="mt-2 text-xl font-bold text-sky-700">{currency.format(Number(selectedClosurePreview.expected_point_sales_total))}</p>
                  </div>
                  <div className="rounded-2xl border bg-violet-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Transf. esperadas</p>
                    <p className="mt-2 text-xl font-bold text-violet-700">{currency.format(Number(selectedClosurePreview.expected_transfer_sales_total))}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white/95 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Efectivo real</p>
                    <div className="mt-3 h-14 rounded-xl border border-dashed border-slate-300 bg-slate-50/70" />
                    <p className="mt-2 text-sm text-muted-foreground">Completa responsable de caja.</p>
                  </div>
                  <div className="rounded-2xl border bg-amber-50 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Diferencia</p>
                    <div className="mt-3 h-14 rounded-xl border border-dashed border-amber-300 bg-amber-50/80" />
                    <p className="mt-2 text-sm text-muted-foreground">Se completa a mano al momento del control.</p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-dashed bg-white/90 p-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedClosurePreview.notes ?? "Sin observaciones"}</p>
                </div>
              </div>

              <div className="rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedClosureSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatTime(sale.sold_at)}</TableCell>
                        <TableCell>{sale.customer_name_snapshot ?? "Consumidor final"}</TableCell>
                        <TableCell>{PAYMENT_LABEL[sale.payment_method]}</TableCell>
                        <TableCell>{sale.receipt_reference ?? RECEIPT_LABEL[sale.receipt_kind]}</TableCell>
                        <TableCell className="text-right font-semibold">{currency.format(Number(sale.amount_total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-white px-6 pb-6 pt-4 sm:justify-end">
            <Button variant="outline" onClick={printClosurePreview}>Imprimir</Button>
            <Button variant="outline" onClick={() => setClosurePreviewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

