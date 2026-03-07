import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, FileDown, Send, Copy, Ban, Pencil, Trash2 } from "lucide-react";
import { useCompanyBrand } from "@/contexts/company-brand-context";

type DocType = "PRESUPUESTO" | "REMITO";
type DocStatus = "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO";
type CustomerKind = "GENERAL" | "INTERNO" | "EMPRESA";
type InternalRemitoType = "CUENTA_CORRIENTE" | "DESCUENTO_SUELDO";

interface LineDraft {
  item_id: string | null;
  sku_snapshot: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

interface DocRow {
  id: string;
  doc_type: DocType;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_tax_condition: string | null;
  customer_kind: CustomerKind;
  internal_remito_type: InternalRemitoType | null;
  price_list_id: string | null;
  source_document_id: string | null;
  notes: string | null;
  subtotal: number;
  total: number;
  created_at: string;
}

interface DocLineRow {
  id: string;
  item_id: string | null;
  line_order: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
  sku_snapshot: string | null;
}

interface PriceListRow {
  id: string;
  name: string;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  round_mode: "none" | "integer" | "tens" | "hundreds" | "x99";
  round_to: number | null;
}

interface PriceListItemRow {
  item_id: string;
  is_active: boolean;
  base_cost: number;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  final_price_override: number | null;
  items: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  } | null;
}

const DOC_LABEL: Record<DocType, string> = { PRESUPUESTO: "Presupuesto", REMITO: "Remito" };
const STATUS_LABEL: Record<DocStatus, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  EMITIDO: "Emitido",
  ANULADO: "Anulado",
};
const STATUS_VARIANT: Record<DocStatus, "secondary" | "default" | "destructive" | "outline"> = {
  BORRADOR: "secondary",
  ENVIADO: "outline",
  APROBADO: "default",
  RECHAZADO: "destructive",
  EMITIDO: "default",
  ANULADO: "destructive",
};
const DOC_TYPE_CLASS: Record<DocType, string> = {
  PRESUPUESTO: "border-blue-200 bg-blue-50 text-blue-700",
  REMITO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  GENERAL: "Cliente general",
  INTERNO: "Personal / tecnico interno",
  EMPRESA: "Empresa",
};
const INTERNAL_REMITO_LABEL: Record<InternalRemitoType, string> = {
  CUENTA_CORRIENTE: "Cuenta corriente",
  DESCUENTO_SUELDO: "Descuento de sueldo",
};

const EMPTY_LINE: LineDraft = { item_id: null, sku_snapshot: "", description: "", unit: "un", quantity: 1, unit_price: 0 };

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Error desconocido";
};

const formatNumber = (n: number | null, pointOfSale: number) => {
  if (n === null) return "BORRADOR";
  return `${String(pointOfSale).padStart(4, "0")}-${String(n).padStart(8, "0")}`;
};

export default function DocumentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { settings: companySettings } = useCompanyBrand();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const [form, setForm] = useState({
    doc_type: "PRESUPUESTO" as DocType,
    point_of_sale: companySettings.default_point_of_sale ?? 1,
    customer_id: "",
    customer_name: "",
    customer_tax_condition: "",
    customer_tax_id: "",
    customer_kind: "GENERAL" as CustomerKind,
    internal_remito_type: "" as InternalRemitoType | "",
    price_list_id: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([EMPTY_LINE]);

  const { data: customers = [] } = useQuery({
    queryKey: ["documents-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, cuit").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["documents-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("id, sku, name, unit").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceLists = [] } = useQuery({
    queryKey: ["documents-price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, flete_pct, utilidad_pct, impuesto_pct, round_mode, round_to")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PriceListRow[];
    },
  });

  const { data: priceListItems = [] } = useQuery({
    queryKey: ["documents-price-list-items", form.price_list_id],
    enabled: !!form.price_list_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select("item_id, is_active, base_cost, flete_pct, utilidad_pct, impuesto_pct, final_price_override, items(id, sku, name, unit)")
        .eq("price_list_id", form.price_list_id)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as PriceListItemRow[];
    },
  });

  const selectedPriceList = useMemo(
    () => priceLists.find((row) => row.id === form.price_list_id) ?? null,
    [priceLists, form.price_list_id],
  );

  const applyRounding = (value: number, roundMode: PriceListRow["round_mode"], roundTo: number | null) => {
    switch (roundMode) {
      case "integer":
        return Math.round(value);
      case "tens":
        return Math.round(value / 10) * 10;
      case "hundreds":
        return Math.round(value / 100) * 100;
      case "x99":
        return value <= 0 ? 0 : Math.floor(value) + 0.99;
      case "none":
      default: {
        const safeRoundTo = !roundTo || roundTo <= 0 ? 1 : roundTo;
        if (safeRoundTo === 1) return value;
        return Math.round(value / safeRoundTo) * safeRoundTo;
      }
    }
  };

  const availableItems = useMemo(() => {
    if (!form.price_list_id) return items;
    return priceListItems
      .filter((row) => row.items)
      .map((row) => ({
        id: row.items!.id,
        sku: row.items!.sku,
        name: row.items!.name,
        unit: row.items!.unit,
      }));
  }, [items, form.price_list_id, priceListItems]);

  const priceByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of priceListItems) {
      if (row.final_price_override !== null && Number(row.final_price_override) > 0) {
        map.set(row.item_id, Number(row.final_price_override));
        continue;
      }
      if (!selectedPriceList) {
        map.set(row.item_id, 0);
        continue;
      }

      const baseCost = Number(row.base_cost) || 0;
      if (baseCost <= 0) {
        map.set(row.item_id, 0);
        continue;
      }

      const flete = row.flete_pct ?? selectedPriceList.flete_pct ?? 0;
      const utilidad = row.utilidad_pct ?? selectedPriceList.utilidad_pct ?? 0;
      const impuesto = row.impuesto_pct ?? selectedPriceList.impuesto_pct ?? 0;
      const computed = baseCost * (1 + flete / 100) * (1 + utilidad / 100) * (1 + impuesto / 100);
      map.set(row.item_id, applyRounding(computed, selectedPriceList.round_mode, selectedPriceList.round_to));
    }
    return map;
  }, [priceListItems, selectedPriceList]);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", search, typeFilter, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("documents")
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, customer_name, customer_tax_id, customer_tax_condition, customer_kind, internal_remito_type, price_list_id, source_document_id, notes, subtotal, total, created_at")
        .order("created_at", { ascending: false });
      if (typeFilter !== "ALL") q = q.eq("doc_type", typeFilter);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      if (search.trim()) {
        const n = Number.parseInt(search.trim(), 10);
        const clauses = [`customer_name.ilike.%${search.trim()}%`];
        if (Number.isFinite(n)) clauses.push(`document_number.eq.${n}`);
        q = q.or(clauses.join(","));
      }
      const { data, error } = await q.limit(300);
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const { data: selectedLines = [] } = useQuery({
    queryKey: ["document-lines", selectedDocId],
    enabled: !!selectedDocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_lines")
        .select("id, item_id, line_order, description, quantity, unit, unit_price, line_total, sku_snapshot")
        .eq("document_id", selectedDocId!)
        .order("line_order");
      if (error) throw error;
      return (data ?? []) as DocLineRow[];
    },
  });

  const selectedDocument = useMemo(
    () => documents.find((row) => row.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const totalDraft = useMemo(() => lines.reduce((acc, line) => acc + line.quantity * line.unit_price, 0), [lines]);

  useEffect(() => {
    if (!form.price_list_id) return;
    setLines((prev) => prev.map((line) => {
      if (!line.item_id || !priceByItem.has(line.item_id)) return line;
      return { ...line, unit_price: priceByItem.get(line.item_id) ?? 0 };
    }));
  }, [form.price_list_id, priceByItem]);

  const resetDraftForm = () => {
    setEditingDocId(null);
    setForm({
      doc_type: "PRESUPUESTO",
      point_of_sale: companySettings.default_point_of_sale ?? 1,
      customer_id: "",
      customer_name: "",
      customer_tax_condition: "",
      customer_tax_id: "",
      customer_kind: "GENERAL",
      internal_remito_type: "",
      price_list_id: "",
      notes: "",
    });
    setLines([EMPTY_LINE]);
  };

  const openCreateDialog = () => {
    resetDraftForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (docId: string) => {
    const target = documents.find((d) => d.id === docId);
    if (!target || target.status !== "BORRADOR") return;

    const { data: lineRows, error } = await supabase
      .from("document_lines")
      .select("item_id, sku_snapshot, description, unit, quantity, unit_price")
      .eq("document_id", docId)
      .order("line_order");
    if (error) {
      toast({ title: "Error", description: "No se pudo cargar el borrador", variant: "destructive" });
      return;
    }

    setEditingDocId(docId);
    setForm({
      doc_type: target.doc_type,
      point_of_sale: target.point_of_sale,
      customer_id: target.customer_id ?? "",
      customer_name: target.customer_name ?? "",
      customer_tax_condition: target.customer_tax_condition ?? "",
      customer_tax_id: target.customer_tax_id ?? "",
      customer_kind: target.customer_kind ?? "GENERAL",
      internal_remito_type: target.internal_remito_type ?? "",
      price_list_id: target.price_list_id ?? "",
      notes: target.notes ?? "",
    });
    const nextLines = (lineRows ?? []).map((line) => ({
      item_id: line.item_id,
      sku_snapshot: line.sku_snapshot ?? "",
      description: line.description,
      unit: line.unit ?? "un",
      quantity: Number(line.quantity) || 0,
      unit_price: Number(line.unit_price) || 0,
    }));
    setLines(nextLines.length > 0 ? nextLines : [EMPTY_LINE]);
    setDialogOpen(true);
  };

  const upsertDraftMutation = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((line) => line.description.trim() && line.quantity > 0);
      if (valid.length === 0) throw new Error("Agrega al menos una linea valida");
      if (form.doc_type === "PRESUPUESTO" && form.customer_kind === "INTERNO") {
        throw new Error("Los presupuestos no aplican a personal interno");
      }
      if (form.doc_type === "REMITO" && form.customer_kind === "INTERNO" && !form.internal_remito_type) {
        throw new Error("El remito interno requiere definir si va a cuenta corriente o descuento de sueldo");
      }
      if (form.customer_kind !== "INTERNO" && form.internal_remito_type) {
        throw new Error("El tipo de remito interno solo aplica a remitos del personal interno");
      }

      if (form.price_list_id) {
        const missingItem = valid.some((line) => !line.item_id);
        if (missingItem) throw new Error("Con lista de precios activa, todas las lineas deben tener item");
      }

      const normalizedLines = valid.map((line) => {
        if (!form.price_list_id || !line.item_id) return line;
        if (!priceByItem.has(line.item_id)) {
          throw new Error("Hay items sin precio en la lista seleccionada");
        }
        return { ...line, unit_price: priceByItem.get(line.item_id) ?? 0 };
      });

      const pickedCustomer = form.customer_id ? customers.find((c) => c.id === form.customer_id) : null;
      const customerName = pickedCustomer?.name ?? form.customer_name ?? "Cliente ocasional";
      const customerTaxId = form.customer_tax_id || pickedCustomer?.cuit || null;

      let documentId = editingDocId;
      if (!documentId) {
        const { data: doc, error: docErr } = await supabase
          .from("documents")
          .insert({
            doc_type: form.doc_type,
            status: "BORRADOR",
            point_of_sale: form.point_of_sale,
            customer_id: form.customer_id || null,
            customer_name: customerName || null,
            customer_tax_condition: form.customer_tax_condition || null,
            customer_tax_id: customerTaxId,
            customer_kind: form.customer_kind,
            internal_remito_type: form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? form.internal_remito_type || null : null,
            price_list_id: form.price_list_id || null,
            notes: form.notes || null,
            subtotal: totalDraft,
            total: totalDraft,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentId = doc.id;
      } else {
        const { error: updErr } = await supabase
          .from("documents")
          .update({
            doc_type: form.doc_type,
            point_of_sale: form.point_of_sale,
            customer_id: form.customer_id || null,
            customer_name: customerName || null,
            customer_tax_condition: form.customer_tax_condition || null,
            customer_tax_id: customerTaxId,
            customer_kind: form.customer_kind,
            internal_remito_type: form.doc_type === "REMITO" && form.customer_kind === "INTERNO" ? form.internal_remito_type || null : null,
            price_list_id: form.price_list_id || null,
            notes: form.notes || null,
            subtotal: totalDraft,
            total: totalDraft,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("status", "BORRADOR");
        if (updErr) throw updErr;

        const { error: delErr } = await supabase
          .from("document_lines")
          .delete()
          .eq("document_id", documentId);
        if (delErr) throw delErr;
      }

      const payload = normalizedLines.map((line, index) => ({
        document_id: documentId,
        line_order: index + 1,
        item_id: line.item_id,
        sku_snapshot: line.sku_snapshot || null,
        description: line.description,
        unit: line.unit || null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_total: line.quantity * line.unit_price,
        created_by: user?.id,
      }));
      const { error: lineErr } = await supabase.from("document_lines").insert(payload);
      if (lineErr) throw lineErr;

      await supabase.from("document_events").insert({
        document_id: documentId,
        event_type: editingDocId ? "UPDATED" : "CREATED",
        payload: { source: "ui" },
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      setDialogOpen(false);
      resetDraftForm();
      toast({ title: editingDocId ? "Borrador actualizado" : "Borrador guardado" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const issueMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const currentDocument = documents.find((row) => row.id === documentId);
      if (currentDocument?.doc_type !== "REMITO") {
        throw new Error("Solo los remitos se emiten");
      }
      const { data: remitoLines, error: linesError } = await supabase
        .from("document_lines")
        .select("item_id")
        .eq("document_id", documentId);
      if (linesError) throw linesError;
      if ((remitoLines ?? []).some((line) => !line.item_id)) {
        throw new Error("El remito tiene lineas sin item asociado y no se puede emitir");
      }
      const { error } = await supabase.rpc("issue_document", { p_document_id: documentId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Documento emitido" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error al emitir",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ documentId, targetStatus }: { documentId: string; targetStatus: DocStatus }) => {
      const { error } = await supabase.rpc("transition_document_status", {
        p_document_id: documentId,
        p_target_status: targetStatus,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["stock-current"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: `Documento ${STATUS_LABEL[variables.targetStatus].toLowerCase()}` });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo cambiar el estado",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const cloneAsRemitoMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { data: src, error: srcErr } = await supabase
        .from("documents")
        .select("*")
        .eq("id", sourceId)
        .single();
      if (srcErr) throw srcErr;

      const { data: srcLines, error: lineErr } = await supabase
        .from("document_lines")
        .select("*")
        .eq("document_id", sourceId)
        .order("line_order");
      if (lineErr) throw lineErr;

      if (src.status === "ANULADO") {
        throw new Error("No se puede convertir a remito un presupuesto anulado");
      }
      if (src.status !== "APROBADO") {
        throw new Error("Solo se puede convertir a remito un presupuesto aprobado");
      }
      if ((srcLines ?? []).some((line) => !line.item_id)) {
        throw new Error("El presupuesto tiene lineas sin item asociado. Completa los items antes de convertir a remito");
      }

      const { data: newDoc, error: newDocErr } = await supabase
        .from("documents")
        .insert({
          doc_type: "REMITO",
          status: "BORRADOR",
          point_of_sale: src.point_of_sale,
          customer_id: src.customer_id,
          customer_name: src.customer_name,
          customer_tax_condition: src.customer_tax_condition,
          customer_tax_id: src.customer_tax_id,
          customer_kind: src.customer_kind,
          internal_remito_type: src.internal_remito_type,
          price_list_id: src.price_list_id,
          source_document_id: src.id,
          notes: src.notes,
          subtotal: src.subtotal,
          total: src.total,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (newDocErr) throw newDocErr;

      const linesPayload = (srcLines ?? []).map((line) => ({
        document_id: newDoc.id,
        line_order: line.line_order,
        item_id: line.item_id,
        sku_snapshot: line.sku_snapshot,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_pct: line.discount_pct,
        line_total: line.line_total,
        created_by: user?.id,
      }));
      const { error: insErr } = await supabase.from("document_lines").insert(linesPayload);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Remito borrador creado" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo convertir a remito", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const onPickItem = (idx: number, itemId: string) => {
    const item = items.find((row) => row.id === itemId);
    if (!item) return;
    const next = [...lines];
    next[idx] = {
      ...next[idx],
      item_id: itemId,
      sku_snapshot: item.sku,
      description: item.name,
      unit: item.unit || "un",
      unit_price: form.price_list_id ? (priceByItem.get(itemId) ?? 0) : next[idx].unit_price,
    };
    setLines(next);
  };

  const onPriceListChange = (priceListId: string) => {
    if (priceListId === form.price_list_id) return;

    const hasLoadedLines = lines.some((line) =>
      line.item_id !== null ||
      line.description.trim() !== "" ||
      line.quantity !== EMPTY_LINE.quantity ||
      line.unit_price !== EMPTY_LINE.unit_price,
    );

    if (hasLoadedLines) {
      const confirmed = window.confirm(
        "Cambiar la lista va a eliminar todas las lineas cargadas para evitar mezclar productos y precios. ¿Querés continuar?",
      );
      if (!confirmed) return;
    }

    setForm((prev) => ({ ...prev, price_list_id: priceListId }));
    setLines([EMPTY_LINE]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => {
      if (prev.length === 1) return [EMPTY_LINE];
      return prev.filter((_, lineIdx) => lineIdx !== idx);
    });
  };

  const printDocument = async (doc: DocRow) => {
    const { data: lineRows } = await supabase
      .from("document_lines")
      .select("line_order, sku_snapshot, description, unit, quantity, unit_price, line_total")
      .eq("document_id", doc.id)
      .order("line_order");

    const printableLines = (lineRows ?? []) as Array<
      Pick<DocLineRow, "line_order" | "sku_snapshot" | "description" | "quantity" | "unit" | "unit_price" | "line_total">
    >;

    const rows = printableLines.map((line) => `
      <tr>
        <td>${line.line_order}</td>
        <td>${line.sku_snapshot ?? "-"}</td>
        <td>${line.description}</td>
        <td style="text-align:right">${Number(line.quantity).toLocaleString("es-AR")}</td>
        <td>${line.unit ?? "un"}</td>
        <td style="text-align:right">$${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${Number(line.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const win = window.open("", "_blank");
    if (!win) return;
    const logoBlock = companySettings.logo_url
      ? `<img src="${companySettings.logo_url}" alt="${companySettings.app_name}" style="max-height:110px;max-width:320px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(15,23,42,.10))" />`
      : `<div style="font-size:30px;font-weight:800;letter-spacing:.05em;color:#0f172a">${companySettings.app_name.toUpperCase()}</div>`;

    win.document.write(`<!doctype html><html><head><title>${DOC_LABEL[doc.doc_type]} ${formatNumber(doc.document_number, doc.point_of_sale)}</title>
      <style>
      @page{size:A4 portrait;margin:10mm}
      html,body{margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc}
      .print-shell{width:190mm;max-width:190mm;margin:0 auto;padding:6mm 0}
      .sheet{border:1px solid #d6dbe3;border-radius:22px;padding:8mm;background:#fff;box-shadow:0 20px 60px rgba(15,23,42,.08);box-sizing:border-box}
      .head{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:stretch;margin-bottom:18px}
      .brand{display:flex;flex-direction:column;justify-content:space-between;min-height:150px;padding:18px;border-radius:18px;background:linear-gradient(135deg,#ffffff 0%,#f5f9ff 60%,#eef4ff 100%);border:1px solid #dbe7f5}
      .brand-copy{display:flex;flex-direction:column;gap:8px}
      .eyebrow{display:inline-flex;width:max-content;border:1px solid #dbe3ee;border-radius:999px;background:#ffffff;padding:6px 12px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#475569}
      .muted{color:#475569;font-size:12px;margin:2px 0}
      .brand-name{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:.04em}
      .docbox{padding:18px;border-radius:18px;min-width:290px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f8fafc}
      .docbox h2{margin:0 0 10px 0;font-size:22px}
      .docline{font-size:12px;color:#dbeafe;margin:6px 0}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
      .meta-card{border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#fff}
      .meta-title{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 10px 0}
      table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;overflow:hidden;border:1px solid #dbe3ee;border-radius:16px}
      th,td{padding:10px 12px;font-size:12px;border-bottom:1px solid #e8eef5}
      th{background:#eef4f8;text-align:left;color:#334155}
      tbody tr:nth-child(even){background:#fbfdff}
      tbody tr:last-child td{border-bottom:none}
      .totals{display:flex;justify-content:flex-end;margin-top:16px}
      .totals-box{min-width:260px;border:1px solid #dbe3ee;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);border-radius:18px;padding:14px 16px}
      .totals-label{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#64748b}
      .totals-value{margin-top:6px;font-size:26px;font-weight:800;color:#0f172a}
      .notes{margin-top:16px;border:1px dashed #cbd5e1;border-radius:18px;padding:14px 16px;font-size:12px;min-height:56px;background:#fcfcfd}
      .foot{margin-top:22px;font-size:11px;color:#64748b;display:flex;justify-content:space-between;gap:16px}
      .print-action{display:block;margin:16px auto 0;padding:10px 16px;border:none;border-radius:999px;background:#0f172a;color:#fff;cursor:pointer}
      @media print{
        body{background:#fff}
        .print-shell{width:190mm;max-width:190mm;padding:0}
        .sheet{border:none;box-shadow:none;border-radius:0;padding:0}
        .print-action{display:none}
      }
      </style></head><body>
      <div class="print-shell">
      <div class="sheet">
      <div class="head">
        <div class="brand">
          <div class="brand-copy">
            <span class="eyebrow">${DOC_LABEL[doc.doc_type]}</span>
            ${logoBlock}
          </div>
          <div>
            <p class="brand-name">${companySettings.legal_name ?? companySettings.app_name}</p>
            <p class="muted">${companySettings.document_tagline ?? "Documentacion comercial"}</p>
          </div>
        </div>
        <div class="docbox">
          <h2>${DOC_LABEL[doc.doc_type]}</h2>
          <p class="docline"><strong>Nro:</strong> ${formatNumber(doc.document_number, doc.point_of_sale)}</p>
          <p class="docline"><strong>Fecha:</strong> ${new Date(doc.issue_date).toLocaleDateString("es-AR")}</p>
          <p class="docline"><strong>Estado:</strong> ${STATUS_LABEL[doc.status]}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <p class="meta-title">Cliente</p>
          <p class="muted"><strong>Cliente:</strong> ${doc.customer_name ?? "Cliente ocasional"}</p>
          <p class="muted"><strong>Tipo:</strong> ${CUSTOMER_KIND_LABEL[doc.customer_kind]}</p>
          <p class="muted"><strong>CUIT:</strong> ${doc.customer_tax_id ?? "-"}</p>
          <p class="muted"><strong>Condicion fiscal:</strong> ${doc.customer_tax_condition ?? "-"}</p>
        </div>
        <div class="meta-card">
          <p class="meta-title">Operacion</p>
          <p class="muted"><strong>Punto de venta:</strong> ${String(doc.point_of_sale).padStart(4, "0")}</p>
          <p class="muted"><strong>Tipo:</strong> ${DOC_LABEL[doc.doc_type]}</p>
          <p class="muted"><strong>Estado:</strong> ${STATUS_LABEL[doc.status]}</p>
          ${doc.internal_remito_type ? `<p class="muted"><strong>Imputacion:</strong> ${INTERNAL_REMITO_LABEL[doc.internal_remito_type]}</p>` : ""}
          <p class="muted"><strong>Creado:</strong> ${new Date(doc.created_at).toLocaleString("es-AR")}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>#</th><th>SKU</th><th>Descripcion</th><th>Cant.</th><th>Unidad</th><th>P.Unit.</th><th>Importe</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals"><div class="totals-box"><div class="totals-label">Total documento</div><div class="totals-value">$${Number(doc.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div></div></div>
      <div class="notes"><strong>Notas:</strong> ${doc.notes ?? "-"}</div>

      <div class="foot"><span>Generado por ${companySettings.app_name}</span><span>${companySettings.document_footer ?? "Este documento no reemplaza comprobantes fiscales"}</span></div>
      </div>
      </div>
      <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
      </body></html>`);
    win.document.close();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground">Presupuestos y remitos rapidos</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo documento
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente o numero..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full md:w-52">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocType | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PRESUPUESTO">Presupuestos</SelectItem>
                <SelectItem value="REMITO">Remitos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-52">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="BORRADOR">Borrador</SelectItem>
                <SelectItem value="ENVIADO">Enviado</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                <SelectItem value="EMITIDO">Emitido</SelectItem>
                <SelectItem value="ANULADO">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Numero</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[260px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : documents.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Sin documentos</TableCell></TableRow>
              ) : documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Badge variant="outline" className={DOC_TYPE_CLASS[doc.doc_type]}>
                      {DOC_LABEL[doc.doc_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{formatNumber(doc.document_number, doc.point_of_sale)}</TableCell>
                  <TableCell className="font-medium">{doc.customer_name ?? "Cliente ocasional"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[doc.status]}>{STATUS_LABEL[doc.status]}</Badge></TableCell>
                  <TableCell className="text-right font-mono">${Number(doc.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{new Date(doc.issue_date).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedDocId(doc.id); setDetailOpen(true); }} title="Ver">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => printDocument(doc)} title="Imprimir / PDF">
                        <FileDown className="h-4 w-4" />
                      </Button>
                      {doc.status === "BORRADOR" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(doc.id)} title="Editar borrador">
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                        </>
                      )}
                      {doc.doc_type === "PRESUPUESTO" && doc.status === "BORRADOR" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ENVIADO" })} title="Marcar como enviado">
                            <Send className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "APROBADO" })} title="Aprobar">
                            <Send className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "RECHAZADO" })} title="Rechazar">
                            <Ban className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ANULADO" })} title="Anular">
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {doc.doc_type === "PRESUPUESTO" && doc.status === "ENVIADO" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "APROBADO" })} title="Aprobar">
                            <Send className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "RECHAZADO" })} title="Rechazar">
                            <Ban className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ANULADO" })} title="Anular">
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {doc.doc_type === "REMITO" && doc.status === "BORRADOR" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => issueMutation.mutate(doc.id)} title="Emitir remito">
                            <Send className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ANULADO" })} title="Anular borrador">
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" && (
                        <Button variant="ghost" size="icon" onClick={() => cloneAsRemitoMutation.mutate(doc.id)} title="Convertir a remito">
                          <Copy className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" && (
                        <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ANULADO" })} title="Anular">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {doc.doc_type === "REMITO" && doc.status === "EMITIDO" && (
                        <Button variant="ghost" size="icon" onClick={() => transitionMutation.mutate({ documentId: doc.id, targetStatus: "ANULADO" })} title="Anular remito">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDraftForm(); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editingDocId ? "Editar borrador" : "Nuevo documento"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsertDraftMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={form.doc_type}
                  onValueChange={(v) =>
                    setForm((prev) => {
                      const nextDocType = v as DocType;
                      const nextCustomerKind = nextDocType === "PRESUPUESTO" && prev.customer_kind === "INTERNO" ? "GENERAL" : prev.customer_kind;
                      return {
                        ...prev,
                        doc_type: nextDocType,
                        customer_kind: nextCustomerKind,
                        internal_remito_type: nextDocType === "REMITO" && nextCustomerKind === "INTERNO" ? prev.internal_remito_type : "",
                      };
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESUPUESTO">Presupuesto</SelectItem>
                    <SelectItem value="REMITO">Remito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Punto de venta</Label>
                <Input type="number" min={1} value={form.point_of_sale} onChange={(e) => setForm((prev) => ({ ...prev, point_of_sale: Math.max(1, Number(e.target.value) || 1) }))} />
              </div>
              <div className="space-y-2">
                <Label>Lista de precios</Label>
                <Select value={form.price_list_id || "__none__"} onValueChange={(v) => onPriceListChange(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin lista</SelectItem>
                    {priceLists.map((pl) => <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select
                  value={form.customer_kind}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      customer_kind: v as CustomerKind,
                      internal_remito_type: v === "INTERNO" && prev.doc_type === "REMITO" ? prev.internal_remito_type : "",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">Cliente general</SelectItem>
                    {form.doc_type === "REMITO" && <SelectItem value="INTERNO">Personal / tecnico interno</SelectItem>}
                    <SelectItem value="EMPRESA">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente registrado</Label>
                <Select value={form.customer_id || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, customer_id: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre cliente</Label>
                <Input value={form.customer_name} onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CUIT</Label>
                <Input value={form.customer_tax_id} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_id: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Condicion fiscal</Label>
                <Input value={form.customer_tax_condition} onChange={(e) => setForm((prev) => ({ ...prev, customer_tax_condition: e.target.value }))} />
              </div>
            </div>

            {form.doc_type === "REMITO" && form.customer_kind === "INTERNO" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Imputacion del remito</Label>
                  <Select
                    value={form.internal_remito_type || "__none__"}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, internal_remito_type: v === "__none__" ? "" : (v as InternalRemitoType) }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUENTA_CORRIENTE">Cuenta corriente</SelectItem>
                      <SelectItem value="DESCUENTO_SUELDO">Descuento de sueldo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lineas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, EMPTY_LINE])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Linea
                </Button>
              </div>
              {form.price_list_id && (
                <p className="text-xs text-muted-foreground">Con lista activa, solo aparecen items de esa lista y el precio unitario se toma automaticamente.</p>
              )}
              <div className="space-y-2">
                {lines.map((line, idx) => {
                  const lockPrice = !!form.price_list_id && !!line.item_id;
                  const lockDescription = !!line.item_id;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <Select value={line.item_id ?? "__none__"} onValueChange={(v) => onPickItem(idx, v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                          <SelectContent>
                            {!form.price_list_id && <SelectItem value="__none__">Manual</SelectItem>}
                            {availableItems.map((it) => <SelectItem key={it.id} value={it.id}>{it.sku} - {it.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input className="col-span-4" placeholder="Descripcion" value={line.description} disabled={lockDescription} onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setLines(next);
                      }} />
                      <Input className="col-span-1" type="number" min={0.001} step="any" value={line.quantity} onChange={(e) => {
                        const next = [...lines];
                        next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                        setLines(next);
                      }} />
                      <Input
                        className="col-span-2"
                        type="number"
                        min={0}
                        step="any"
                        value={line.unit_price}
                        disabled={lockPrice}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...next[idx], unit_price: Number(e.target.value) || 0 };
                          setLines(next);
                        }}
                      />
                      <div className="col-span-2 flex items-center justify-end text-sm font-mono">
                        ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="col-span-12 flex justify-end md:col-span-12">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(idx)}
                          title="Eliminar linea"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Eliminar linea
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-right font-bold">Total: ${totalDraft.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={upsertDraftMutation.isPending}>
                {upsertDraftMutation.isPending ? "Guardando..." : editingDocId ? "Actualizar borrador" : "Guardar borrador"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Vista previa del documento</DialogTitle></DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border bg-gradient-to-br from-white via-white to-[hsl(var(--accent))]/70 p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <Badge variant="outline" className={DOC_TYPE_CLASS[selectedDocument.doc_type]}>
                        {DOC_LABEL[selectedDocument.doc_type]}
                      </Badge>
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
                      <p className="mt-1 text-lg font-bold">{DOC_LABEL[selectedDocument.doc_type]}</p>
                      <p className="mt-2 text-xs text-slate-300">{formatNumber(selectedDocument.document_number, selectedDocument.point_of_sale)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-white/80 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                      <p className="mt-2 font-semibold">{selectedDocument.customer_name ?? "Cliente ocasional"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Tipo: {CUSTOMER_KIND_LABEL[selectedDocument.customer_kind]}</p>
                      <p className="mt-1 text-sm text-muted-foreground">CUIT: {selectedDocument.customer_tax_id ?? "-"}</p>
                      <p className="text-sm text-muted-foreground">Condicion fiscal: {selectedDocument.customer_tax_condition ?? "-"}</p>
                    </div>
                    <div className="rounded-2xl border bg-white/80 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Operacion</p>
                      <p className="mt-2 text-sm"><span className="font-semibold">Fecha:</span> {new Date(selectedDocument.issue_date).toLocaleDateString("es-AR")}</p>
                      <p className="text-sm"><span className="font-semibold">Estado:</span> {STATUS_LABEL[selectedDocument.status]}</p>
                      <p className="text-sm"><span className="font-semibold">Punto de venta:</span> {String(selectedDocument.point_of_sale).padStart(4, "0")}</p>
                      {selectedDocument.internal_remito_type && (
                        <p className="text-sm"><span className="font-semibold">Imputacion:</span> {INTERNAL_REMITO_LABEL[selectedDocument.internal_remito_type]}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border bg-card p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Resumen</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border bg-[hsl(var(--accent))]/50 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total documento</p>
                      <p className="mt-2 text-3xl font-black text-primary">
                        ${Number(selectedDocument.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-dashed p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                      <p className="mt-2 text-sm text-muted-foreground">{selectedDocument.notes ?? "Sin observaciones cargadas."}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">P.Unit.</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.line_order}</TableCell>
                        <TableCell className="font-mono text-xs">{line.sku_snapshot ?? "-"}</TableCell>
                        <TableCell className="font-medium">{line.description}</TableCell>
                        <TableCell className="text-right">{Number(line.quantity).toLocaleString("es-AR")}</TableCell>
                        <TableCell>{line.unit ?? "un"}</TableCell>
                        <TableCell className="text-right font-mono">${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-mono">${Number(line.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
