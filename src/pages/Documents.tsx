import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { getErrorMessage } from "@/lib/errors";
import {
  canCloneBudgetToRemito,
  canCreateDocumentDraft,
  canEditDocumentDraft,
  canIssueRemito,
  canPrintDocument,
  canTransitionDocumentTo,
} from "@/lib/permissions";
import { escapeHtml, escapeHtmlWithLineBreaks, openPrintWindow } from "@/lib/print";
import {
  CUSTOMER_KIND_LABEL,
  DOC_LABEL,
  EMPTY_LINE,
  INTERNAL_REMITO_LABEL,
  STATUS_LABEL,
} from "@/features/documents/constants";
import type {
  CustomerKind,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
} from "@/features/documents/types";
import { formatNumber } from "@/features/documents/utils";
import { useDocumentsData } from "@/features/documents/hooks/useDocumentsData";
import { useDocumentsMutations } from "@/features/documents/hooks/useDocumentsMutations";
import { DocumentsEditorDialog } from "@/features/documents/components/DocumentsEditorDialog";
import { DocumentsList } from "@/features/documents/components/DocumentsList";
import { DocumentsPreviewDialog } from "@/features/documents/components/DocumentsPreviewDialog";

export default function DocumentsPage() {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const { settings: companySettings } = useCompanyBrand();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const [form, setForm] = useState<DocumentFormState>({
    doc_type: "PRESUPUESTO" as DocType,
    point_of_sale: companySettings.default_point_of_sale ?? 1,
    customer_id: "",
    customer_name: "",
    customer_tax_condition: "",
    customer_tax_id: "",
    customer_kind: "GENERAL" as CustomerKind,
    internal_remito_type: "" as InternalRemitoType | "",
    payment_terms: "",
    delivery_address: "",
    salesperson: "",
    valid_until: "",
    price_list_id: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([EMPTY_LINE]);

  const {
    customers,
    items,
    priceLists,
    selectedPriceList,
    availableItems,
    priceByItem,
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    selectedDocument,
    sourceDocumentLabel,
  } = useDocumentsData({
    search,
    typeFilter,
    statusFilter,
    selectedDocId,
    selectedPriceListId: form.price_list_id,
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
      point_of_sale: companySettings.default_point_of_sale ?? 1,
      customer_id: "",
      customer_name: "",
      customer_tax_condition: "",
      customer_tax_id: "",
      customer_kind: "GENERAL",
      internal_remito_type: "",
      payment_terms: "",
      delivery_address: "",
      salesperson: "",
      valid_until: "",
      price_list_id: "",
      notes: "",
    });
    setLines([EMPTY_LINE]);
  };

  const openCreateDialog = () => {
    if (!canCreateDocumentDraft(roles)) return;
    resetDraftForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (docId: string) => {
    if (!canEditDocumentDraft(roles)) return;
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
      payment_terms: target.payment_terms ?? "",
      delivery_address: target.delivery_address ?? "",
      salesperson: target.salesperson ?? "",
      valid_until: target.valid_until ?? "",
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

  const {
    upsertDraftMutation,
    issueMutation,
    transitionMutation,
    cloneAsRemitoMutation,
  } = useDocumentsMutations({
    userId: user?.id,
    documents,
    customers,
    lines,
    form,
    totalDraft,
    editingDocId,
    priceByItem,
    resetDraftForm,
    setDialogOpen,
    toast,
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
        "Cambiar la lista va a eliminar todas las lineas cargadas para evitar mezclar productos y precios. Â¿QuerÃ©s continuar?",
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
        <td>${escapeHtml(line.sku_snapshot ?? "-")}</td>
        <td>${escapeHtml(line.description)}</td>
        <td style="text-align:right">${Number(line.quantity).toLocaleString("es-AR")}</td>
        <td>${escapeHtml(line.unit ?? "un")}</td>
        <td style="text-align:right">$${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${Number(line.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const logoBlock = companySettings.logo_url
      ? `<img src="${escapeHtml(companySettings.logo_url)}" alt="${escapeHtml(companySettings.app_name)}" style="max-height:110px;max-width:320px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(15,23,42,.10))" />`
      : `<div style="font-size:30px;font-weight:800;letter-spacing:.05em;color:#0f172a">${escapeHtml(companySettings.app_name.toUpperCase())}</div>`;

    const win = openPrintWindow(`<!doctype html><html><head><title>${escapeHtml(DOC_LABEL[doc.doc_type])} ${escapeHtml(formatNumber(doc.document_number, doc.point_of_sale))}</title>
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
            <span class="eyebrow">${escapeHtml(DOC_LABEL[doc.doc_type])}</span>
            ${logoBlock}
          </div>
          <div>
            <p class="brand-name">${escapeHtml(companySettings.legal_name ?? companySettings.app_name)}</p>
            <p class="muted">${escapeHtml(companySettings.document_tagline ?? "Documentacion comercial")}</p>
          </div>
        </div>
        <div class="docbox">
          <h2>${escapeHtml(DOC_LABEL[doc.doc_type])}</h2>
          <p class="docline"><strong>Nro:</strong> ${escapeHtml(formatNumber(doc.document_number, doc.point_of_sale))}</p>
          <p class="docline"><strong>Fecha:</strong> ${new Date(doc.issue_date).toLocaleDateString("es-AR")}</p>
          <p class="docline"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[doc.status])}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <p class="meta-title">Cliente</p>
          <p class="muted"><strong>Cliente:</strong> ${escapeHtml(doc.customer_name ?? "Cliente ocasional")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(CUSTOMER_KIND_LABEL[doc.customer_kind])}</p>
          <p class="muted"><strong>CUIT:</strong> ${escapeHtml(doc.customer_tax_id ?? "-")}</p>
          <p class="muted"><strong>Condicion fiscal:</strong> ${escapeHtml(doc.customer_tax_condition ?? "-")}</p>
        </div>
        <div class="meta-card">
          <p class="meta-title">Operacion</p>
          <p class="muted"><strong>Punto de venta:</strong> ${String(doc.point_of_sale).padStart(4, "0")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(DOC_LABEL[doc.doc_type])}</p>
          <p class="muted"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[doc.status])}</p>
          ${doc.payment_terms ? `<p class="muted"><strong>Condicion de venta:</strong> ${escapeHtml(doc.payment_terms)}</p>` : ""}
          ${doc.salesperson ? `<p class="muted"><strong>Vendedor:</strong> ${escapeHtml(doc.salesperson)}</p>` : ""}
          ${doc.valid_until ? `<p class="muted"><strong>Valido hasta:</strong> ${new Date(doc.valid_until).toLocaleDateString("es-AR")}</p>` : ""}
          ${doc.delivery_address ? `<p class="muted"><strong>Entrega:</strong> ${escapeHtml(doc.delivery_address)}</p>` : ""}
          ${doc.source_document_type && doc.source_document_number_snapshot ? `<p class="muted"><strong>Origen:</strong> ${escapeHtml(DOC_LABEL[doc.source_document_type])} ${escapeHtml(doc.source_document_number_snapshot)}</p>` : ""}
          ${doc.internal_remito_type ? `<p class="muted"><strong>Imputacion:</strong> ${escapeHtml(INTERNAL_REMITO_LABEL[doc.internal_remito_type])}</p>` : ""}
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
      <div class="notes"><strong>Notas:</strong> ${escapeHtmlWithLineBreaks(doc.notes ?? "-")}</div>

      <div class="foot"><span>Generado por ${escapeHtml(companySettings.app_name)}</span><span>${escapeHtml(companySettings.document_footer ?? "Este documento no reemplaza comprobantes fiscales")}</span></div>
      </div>
      </div>
      <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
      </body></html>`);
    if (!win) return;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
            <p className="text-muted-foreground">Presupuestos y remitos rapidos</p>
          </div>
          <Button onClick={openCreateDialog} disabled={!canCreateDocumentDraft(roles)}>
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

        <DocumentsList
          documents={documents}
          isLoading={isLoading}
          onOpenDetail={(documentId) => {
            setSelectedDocId(documentId);
            setDetailOpen(true);
          }}
          onPrint={(document) => {
            if (!canPrintDocument(roles)) return;
            void printDocument(document);
          }}
          onEditDraft={openEditDialog}
          onTransition={(documentId, targetStatus) => {
            if (!canTransitionDocumentTo(roles, targetStatus)) return;
            transitionMutation.mutate({ documentId, targetStatus });
          }}
          onIssueRemito={(documentId) => {
            if (!canIssueRemito(roles)) return;
            issueMutation.mutate(documentId);
          }}
          onCloneAsRemito={(documentId) => {
            if (!canCloneBudgetToRemito(roles)) return;
            cloneAsRemitoMutation.mutate(documentId);
          }}
          canPrintDocument={canPrintDocument(roles)}
          canEditDocumentDraft={canEditDocumentDraft(roles)}
          canIssueRemito={canIssueRemito(roles)}
          canCloneBudgetToRemito={canCloneBudgetToRemito(roles)}
          canTransitionDocumentTo={(status) =>
            status === "EMITIDO"
              ? false
              : canTransitionDocumentTo(roles, status as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO")
          }
        />
      </div>

      <DocumentsEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingDocId={editingDocId}
        form={form}
        setForm={setForm}
        lines={lines}
        setLines={setLines}
        totalDraft={totalDraft}
        customers={customers}
        priceLists={priceLists}
        availableItems={availableItems}
        onPriceListChange={onPriceListChange}
        onPickItem={onPickItem}
        removeLine={removeLine}
        onSubmit={() => upsertDraftMutation.mutate()}
        onResetDraftForm={resetDraftForm}
        isSubmitting={upsertDraftMutation.isPending || !canCreateDocumentDraft(roles)}
      />

      <DocumentsPreviewDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        selectedDocument={selectedDocument}
        selectedLines={selectedLines}
        selectedEvents={selectedEvents}
        sourceDocumentLabel={sourceDocumentLabel}
        companySettings={companySettings}
      />
    </AppLayout>
  );
}


