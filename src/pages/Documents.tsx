import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { Plus, Search, Eye, FileDown, Send, Copy, Ban, Pencil } from "lucide-react";

type DocType = "PRESUPUESTO" | "REMITO";
type DocStatus = "DRAFT" | "ISSUED" | "CANCELLED";

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
  price_list_id: string | null;
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
const STATUS_LABEL: Record<DocStatus, string> = { DRAFT: "Borrador", ISSUED: "Emitido", CANCELLED: "Anulado" };
const STATUS_VARIANT: Record<DocStatus, "secondary" | "default" | "destructive"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  CANCELLED: "destructive",
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
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const [form, setForm] = useState({
    doc_type: "PRESUPUESTO" as DocType,
    point_of_sale: 1,
    customer_id: "",
    customer_name: "",
    customer_tax_condition: "",
    customer_tax_id: "",
    price_list_id: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([EMPTY_LINE]);
  const [documentLogo, setDocumentLogo] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("documents.logoDataUrl") ?? "";
  });

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
        .select("id, doc_type, status, point_of_sale, document_number, issue_date, customer_id, customer_name, customer_tax_id, customer_tax_condition, price_list_id, notes, subtotal, total, created_at")
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
      point_of_sale: 1,
      customer_id: "",
      customer_name: "",
      customer_tax_condition: "",
      customer_tax_id: "",
      price_list_id: "",
      notes: "",
    });
    setLines([EMPTY_LINE]);
  };

  const openCreateDialog = () => {
    resetDraftForm();
    setDialogOpen(true);
  };

  const updateLogo = (nextValue: string) => {
    setDocumentLogo(nextValue);
    if (typeof window !== "undefined") {
      if (nextValue) window.localStorage.setItem("documents.logoDataUrl", nextValue);
      else window.localStorage.removeItem("documents.logoDataUrl");
    }
  };

  const onLogoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        toast({ title: "Logo invalido", description: "No se pudo leer la imagen seleccionada", variant: "destructive" });
        return;
      }
      updateLogo(result);
      toast({ title: "Logo actualizado" });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const openEditDialog = async (docId: string) => {
    const target = documents.find((d) => d.id === docId);
    if (!target || target.status !== "DRAFT") return;

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
            status: "DRAFT",
            point_of_sale: form.point_of_sale,
            customer_id: form.customer_id || null,
            customer_name: customerName || null,
            customer_tax_condition: form.customer_tax_condition || null,
            customer_tax_id: customerTaxId,
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
            price_list_id: form.price_list_id || null,
            notes: form.notes || null,
            subtotal: totalDraft,
            total: totalDraft,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("status", "DRAFT");
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
      if (currentDocument?.doc_type === "REMITO") {
        const { data: remitoLines, error: linesError } = await supabase
          .from("document_lines")
          .select("item_id")
          .eq("document_id", documentId);
        if (linesError) throw linesError;
        if ((remitoLines ?? []).some((line) => !line.item_id)) {
          throw new Error("El remito tiene lineas sin item asociado y no se puede emitir");
        }
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

  const cancelMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("documents")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .eq("status", "ISSUED")
        .eq("doc_type", "PRESUPUESTO");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Presupuesto anulado" });
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

      if (src.status === "CANCELLED") {
        throw new Error("No se puede convertir a remito un presupuesto anulado");
      }
      if ((srcLines ?? []).some((line) => !line.item_id)) {
        throw new Error("El presupuesto tiene lineas sin item asociado. Completa los items antes de convertir a remito");
      }

      const { data: newDoc, error: newDocErr } = await supabase
        .from("documents")
        .insert({
          doc_type: "REMITO",
          status: "DRAFT",
          point_of_sale: src.point_of_sale,
          customer_id: src.customer_id,
          customer_name: src.customer_name,
          customer_tax_condition: src.customer_tax_condition,
          customer_tax_id: src.customer_tax_id,
          price_list_id: src.price_list_id,
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
    setForm((prev) => ({ ...prev, price_list_id: priceListId }));
    setLines((prev) => prev.map((line) => {
      if (!priceListId) {
        return { ...line, unit_price: line.unit_price };
      }
      if (!line.item_id || !priceByItem.has(line.item_id)) {
        return { ...line, item_id: null, sku_snapshot: "", description: "", unit: "un", unit_price: 0 };
      }
      return { ...line, unit_price: priceByItem.get(line.item_id) ?? 0 };
    }));
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
    const logoBlock = documentLogo
      ? `<img src="${documentLogo}" alt="Logo" style="max-height:72px;max-width:220px;object-fit:contain" />`
      : `<div style="font-size:24px;font-weight:700;letter-spacing:.08em;color:#1f2937">STOCK SUR</div>`;

    win.document.write(`<!doctype html><html><head><title>${DOC_LABEL[doc.doc_type]} ${formatNumber(doc.document_number, doc.point_of_sale)}</title>
      <style>
      body{font-family:Arial,sans-serif;padding:24px;max-width:980px;margin:0 auto;color:#111827;background:#fff}
      .sheet{border:1px solid #d6dbe3;border-radius:14px;padding:22px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid #d6dbe3}
      .brand{display:flex;flex-direction:column;gap:6px}
      .muted{color:#4b5563;font-size:12px;margin:2px 0}
      .docbox{border:1px solid #cbd5e1;background:#f8fafc;padding:12px 14px;border-radius:12px;min-width:290px}
      .docbox h2{margin:0 0 8px 0;font-size:18px}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      .meta-card{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #dbe3ee;padding:8px;font-size:12px}
      th{background:#eef4f8;text-align:left}
      .totals{display:flex;justify-content:flex-end;margin-top:14px}
      .totals-box{border:1px solid #cbd5e1;background:#f8fafc;border-radius:12px;padding:10px 14px;font-weight:bold}
      .notes{margin-top:14px;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 12px;font-size:12px;min-height:42px;background:#fcfcfd}
      .foot{margin-top:18px;font-size:11px;color:#64748b;display:flex;justify-content:space-between}
      @media print{button{display:none}}
      </style></head><body>
      <div class="sheet">
      <div class="head">
        <div class="brand">
          ${logoBlock}
          <p class="muted">Documento comercial interno</p>
        </div>
        <div class="docbox">
          <h2>${DOC_LABEL[doc.doc_type]}</h2>
          <p class="muted"><strong>Nro:</strong> ${formatNumber(doc.document_number, doc.point_of_sale)}</p>
          <p class="muted"><strong>Fecha:</strong> ${new Date(doc.issue_date).toLocaleDateString("es-AR")}</p>
          <p class="muted"><strong>Estado:</strong> ${STATUS_LABEL[doc.status]}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <p class="muted"><strong>Cliente:</strong> ${doc.customer_name ?? "Cliente ocasional"}</p>
          <p class="muted"><strong>CUIT:</strong> ${doc.customer_tax_id ?? "-"}</p>
          <p class="muted"><strong>Condicion fiscal:</strong> ${doc.customer_tax_condition ?? "-"}</p>
        </div>
        <div class="meta-card">
          <p class="muted"><strong>Punto de venta:</strong> ${String(doc.point_of_sale).padStart(4, "0")}</p>
          <p class="muted"><strong>Tipo:</strong> ${DOC_LABEL[doc.doc_type]}</p>
          <p class="muted"><strong>Creado:</strong> ${new Date(doc.created_at).toLocaleString("es-AR")}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>#</th><th>SKU</th><th>Descripcion</th><th>Cant.</th><th>Unidad</th><th>P.Unit.</th><th>Importe</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals"><div class="totals-box">Total: $${Number(doc.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div></div>
      <div class="notes"><strong>Notas:</strong> ${doc.notes ?? "-"}</div>

      <div class="foot"><span>Generado por Stock Sur</span><span>Este documento no reemplaza comprobantes fiscales</span></div>
      </div>
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
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
          <div className="flex items-center gap-2">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoSelected} />
            <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
              {documentLogo ? "Cambiar logo PDF" : "Cargar logo PDF"}
            </Button>
            {documentLogo && (
              <Button type="button" variant="ghost" onClick={() => updateLogo("")}>
                Quitar logo
              </Button>
            )}
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo documento
            </Button>
          </div>
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
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="ISSUED">Emitido</SelectItem>
                <SelectItem value="CANCELLED">Anulado</SelectItem>
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
                  <TableCell>{DOC_LABEL[doc.doc_type]}</TableCell>
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
                      {doc.status === "DRAFT" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(doc.id)} title="Editar borrador">
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => issueMutation.mutate(doc.id)} title="Emitir">
                            <Send className="h-4 w-4 text-emerald-600" />
                          </Button>
                        </>
                      )}
                      {doc.doc_type === "PRESUPUESTO" && doc.status !== "CANCELLED" && (
                        <Button variant="ghost" size="icon" onClick={() => cloneAsRemitoMutation.mutate(doc.id)} title="Convertir a remito">
                          <Copy className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      {doc.status === "ISSUED" && doc.doc_type === "PRESUPUESTO" && (
                        <Button variant="ghost" size="icon" onClick={() => cancelMutation.mutate(doc.id)} title="Anular">
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
                <Select value={form.doc_type} onValueChange={(v) => setForm((prev) => ({ ...prev, doc_type: v as DocType }))}>
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
          <DialogHeader><DialogTitle>Detalle del documento</DialogTitle></DialogHeader>
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
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{Number(line.quantity).toLocaleString("es-AR")}</TableCell>
                  <TableCell>{line.unit ?? "un"}</TableCell>
                  <TableCell className="text-right font-mono">${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">${Number(line.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
