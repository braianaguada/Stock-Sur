import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { buildItemDisplayName } from "@/lib/item-display";
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
import { Plus, Search } from "lucide-react";
import { FilterBar, PageHeader } from "@/components/ui/page";
import {
  CUSTOMER_KIND_LABEL,
  DOC_LABEL,
  EMPTY_LINE,
  INTERNAL_REMITO_LABEL,
  STATUS_LABEL,
} from "@/features/documents/constants";
import { DocumentsDataTable } from "@/features/documents/components/DocumentsDataTable";
import { useDocumentsData } from "@/features/documents/hooks/useDocumentsData";
import { useDocumentDraftLoader } from "@/features/documents/hooks/useDocumentDraftLoader";
import { useDocumentsMutations } from "@/features/documents/hooks/useDocumentsMutations";
import type {
  CustomerKind,
  DocLineRow,
  DocRow,
  DocStatus,
  DocType,
  DocumentFormState,
  InternalRemitoType,
  LineDraft,
  LinePricingMode,
  PriceListItemRow,
} from "@/features/documents/types";
import { calculatePriceFromCostBase, formatNumber } from "@/features/documents/utils";

const PAGE_SIZE_OPTIONS = [10, 50, 100, 200] as const;

const DocumentsEditorDialog = lazy(async () => {
  const module = await import("@/features/documents/components/DocumentsEditorDialog");
  return { default: module.DocumentsEditorDialog };
});

const DocumentsPreviewDialog = lazy(async () => {
  const module = await import("@/features/documents/components/DocumentsPreviewDialog");
  return { default: module.DocumentsPreviewDialog };
});

function DocumentsDialogLoader() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      Cargando documento...
    </div>
  );
}

function buildEmptyDocumentForm(defaultPointOfSale: number): DocumentFormState {
  return {
    doc_type: "PRESUPUESTO",
    point_of_sale: defaultPointOfSale,
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
  };
}

export default function DocumentsPage() {
  const { user, roles, currentCompany } = useAuth();
  const { toast } = useToast();
  const { settings: companySettings } = useCompanyBrand();
  const defaultPointOfSale = companySettings.default_point_of_sale ?? 1;

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsPageSize, setDocumentsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [form, setForm] = useState<DocumentFormState>(() => buildEmptyDocumentForm(defaultPointOfSale));
  const [lines, setLines] = useState<LineDraft[]>([]);

  const {
    customers,
    items,
    priceLists,
    availableItems,
    priceByItem,
    priceListItemByItemId,
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    selectedDocument,
    sourceDocumentLabel,
  } = useDocumentsData({
    search: deferredSearch,
    typeFilter,
    statusFilter,
    selectedDocId,
    selectedPriceListId: form.price_list_id,
    currentCompanyId: currentCompany?.id ?? null,
  });

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const totalDraft = useMemo(
    () => lines.reduce((accumulator, line) => accumulator + line.quantity * line.unit_price, 0),
    [lines],
  );
  const documentsPagination = usePaginationSlice({
    items: documents,
    page: documentsPage,
    pageSize: documentsPageSize,
  });

  useEffect(() => {
    setDocumentsPage(1);
  }, [deferredSearch, typeFilter, statusFilter, documentsPageSize]);

  useEffect(() => {
    if (form.price_list_id || priceLists.length === 0) return;
    setForm((previousForm) => ({ ...previousForm, price_list_id: priceLists[0].id }));
  }, [form.price_list_id, priceLists]);

  const syncLineWithPriceList = useCallback(
    (
      line: LineDraft,
      priceListRow: PriceListItemRow | undefined,
      forceListPrice = false,
    ): LineDraft => {
      if (!priceListRow) return line;

      const suggestedUnitPrice =
        priceByItem.get(priceListRow.item_id) ?? (Number(priceListRow.calculated_price) || 0);
      const baseCost = Number(priceListRow.base_cost) || 0;
      const listFlete = priceListRow.flete_pct !== null ? Number(priceListRow.flete_pct) : null;
      const listUtilidad =
        priceListRow.utilidad_pct !== null ? Number(priceListRow.utilidad_pct) : null;
      const listImpuesto =
        priceListRow.impuesto_pct !== null ? Number(priceListRow.impuesto_pct) : null;
      const nextMode: LinePricingMode = forceListPrice
        ? "LIST_PRICE"
        : line.pricing_mode === "MANUAL_MARGIN" || line.pricing_mode === "MANUAL_PRICE"
          ? line.pricing_mode
          : "LIST_PRICE";

      const nextLine: LineDraft = {
        ...line,
        pricing_mode: nextMode,
        suggested_unit_price: suggestedUnitPrice,
        base_cost_snapshot: baseCost,
        list_flete_pct_snapshot: listFlete,
        list_utilidad_pct_snapshot: listUtilidad,
        list_impuesto_pct_snapshot: listImpuesto,
      };

      if (nextMode === "LIST_PRICE") {
        return {
          ...nextLine,
          unit_price: suggestedUnitPrice,
          manual_margin_pct: null,
        };
      }

      if (nextMode === "MANUAL_MARGIN") {
        const marginPct = nextLine.manual_margin_pct ?? listUtilidad ?? 0;
        return {
          ...nextLine,
          manual_margin_pct: marginPct,
          unit_price: calculatePriceFromCostBase(baseCost, listFlete, marginPct, listImpuesto),
        };
      }

      return nextLine;
    },
    [priceByItem],
  );

  useEffect(() => {
    if (!form.price_list_id) return;

    setLines((previousLines) =>
      previousLines.map((line) => {
        if (!line.item_id) return line;
        return syncLineWithPriceList(line, priceListItemByItemId.get(line.item_id));
      }),
    );
  }, [form.price_list_id, priceListItemByItemId, syncLineWithPriceList]);

  const resetDraftForm = () => {
    setEditingDocId(null);
    setForm(buildEmptyDocumentForm(defaultPointOfSale));
    setLines([]);
  };

  const loadDraftForEditing = useDocumentDraftLoader({ documentsById });

  const openCreateDialog = () => {
    if (!canCreateDocumentDraft(roles)) return;
    resetDraftForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (documentId: string) => {
    if (!canEditDocumentDraft(roles)) return;

    try {
      const draft = await loadDraftForEditing(documentId);
      setEditingDocId(draft.editingDocId);
      setForm(draft.form);
      setLines(draft.lines);
      setDialogOpen(true);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const {
    upsertDraftMutation,
    issueMutation,
    transitionMutation,
    cloneAsRemitoMutation,
  } = useDocumentsMutations({
    currentCompanyId: currentCompany?.id ?? null,
    userId: user?.id,
    documents,
    customers,
    lines,
    form,
    totalDraft,
    editingDocId,
    priceByItem,
    priceListItemByItemId,
    resetDraftForm,
    setDialogOpen,
    toast,
  });

  const addItemToDraft = (itemId: string) => {
    const item = itemsById.get(itemId);
    if (!item) return;

    setLines((previousLines) => {
      const existingIndex = previousLines.findIndex((line) => line.item_id === itemId);
      if (existingIndex >= 0) {
        return previousLines.map((line, index) =>
          index === existingIndex
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      const baseLine: LineDraft = {
        ...EMPTY_LINE,
        item_id: itemId,
        sku_snapshot: item.sku,
        description: item.name,
        unit: item.unit || "un",
        quantity: 1,
        unit_price: priceByItem.get(itemId) ?? 0,
      };

      return [
        ...previousLines,
        syncLineWithPriceList(baseLine, priceListItemByItemId.get(itemId), true),
      ];
    });
  };

  const onPriceListChange = (priceListId: string) => {
    if (priceListId === form.price_list_id) return;

    const hasLoadedLines = lines.some(
      (line) =>
        line.item_id !== null ||
        line.description.trim() !== "" ||
        line.quantity !== EMPTY_LINE.quantity ||
        line.unit_price !== EMPTY_LINE.unit_price,
    );

    if (hasLoadedLines) {
      const confirmed = window.confirm(
        "Cambiar la lista va a eliminar todas las lineas cargadas para evitar mezclar productos y precios. Queres continuar?",
      );
      if (!confirmed) return;
    }

    setForm((previousForm) => ({ ...previousForm, price_list_id: priceListId }));
    setLines([]);
  };

  const removeLine = (index: number) => {
    setLines((previousLines) => previousLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const printDocument = async (document: DocRow) => {
    const { data: lineRows } = await supabase
      .from("document_lines")
      .select("line_order, sku_snapshot, description, unit, quantity, unit_price, line_total")
      .eq("document_id", document.id)
      .order("line_order");

    const printableLines = (lineRows ?? []) as Array<
      Pick<
        DocLineRow,
        | "line_order"
        | "sku_snapshot"
        | "description"
        | "quantity"
        | "unit"
        | "unit_price"
        | "line_total"
      >
    >;

    const rows = printableLines
      .map(
        (line) => `
      <tr>
        <td>${line.line_order}</td>
        <td>${escapeHtml(line.sku_snapshot ?? "-")}</td>
        <td>${escapeHtml(line.description)}</td>
        <td style="text-align:right">${Number(line.quantity).toLocaleString("es-AR")}</td>
        <td>${escapeHtml(line.unit ?? "un")}</td>
        <td style="text-align:right">$${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">$${Number(line.line_total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
      </tr>
    `,
      )
      .join("");

    const logoBlock = companySettings.logo_url
      ? `<img src="${escapeHtml(companySettings.logo_url)}" alt="${escapeHtml(companySettings.app_name)}" style="max-height:110px;max-width:320px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(15,23,42,.10))" />`
      : `<div style="font-size:30px;font-weight:800;letter-spacing:.05em;color:#0f172a">${escapeHtml(companySettings.app_name.toUpperCase())}</div>`;

    const win = openPrintWindow(`<!doctype html><html><head><title>${escapeHtml(DOC_LABEL[document.doc_type])} ${escapeHtml(formatNumber(document.document_number, document.point_of_sale))}</title>
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
            <span class="eyebrow">${escapeHtml(DOC_LABEL[document.doc_type])}</span>
            ${logoBlock}
          </div>
          <div>
            <p class="brand-name">${escapeHtml(companySettings.legal_name ?? companySettings.app_name)}</p>
            <p class="muted">${escapeHtml(companySettings.document_tagline ?? "Documentacion comercial")}</p>
          </div>
        </div>
        <div class="docbox">
          <h2>${escapeHtml(DOC_LABEL[document.doc_type])}</h2>
          <p class="docline"><strong>Nro:</strong> ${escapeHtml(formatNumber(document.document_number, document.point_of_sale))}</p>
          <p class="docline"><strong>Fecha:</strong> ${new Date(document.issue_date).toLocaleDateString("es-AR")}</p>
          <p class="docline"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[document.status])}</p>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <p class="meta-title">Cliente</p>
          <p class="muted"><strong>Cliente:</strong> ${escapeHtml(document.customer_name ?? "Cliente ocasional")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(CUSTOMER_KIND_LABEL[document.customer_kind])}</p>
          <p class="muted"><strong>CUIT:</strong> ${escapeHtml(document.customer_tax_id ?? "-")}</p>
          <p class="muted"><strong>Condicion fiscal:</strong> ${escapeHtml(document.customer_tax_condition ?? "-")}</p>
        </div>
        <div class="meta-card">
          <p class="meta-title">Operacion</p>
          <p class="muted"><strong>Punto de venta:</strong> ${String(document.point_of_sale).padStart(4, "0")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(DOC_LABEL[document.doc_type])}</p>
          <p class="muted"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[document.status])}</p>
          ${document.payment_terms ? `<p class="muted"><strong>Condicion de venta:</strong> ${escapeHtml(document.payment_terms)}</p>` : ""}
          ${document.salesperson ? `<p class="muted"><strong>Vendedor:</strong> ${escapeHtml(document.salesperson)}</p>` : ""}
          ${document.valid_until ? `<p class="muted"><strong>Valido hasta:</strong> ${new Date(document.valid_until).toLocaleDateString("es-AR")}</p>` : ""}
          ${document.delivery_address ? `<p class="muted"><strong>Entrega:</strong> ${escapeHtml(document.delivery_address)}</p>` : ""}
          ${document.source_document_type && document.source_document_number_snapshot ? `<p class="muted"><strong>Origen:</strong> ${escapeHtml(DOC_LABEL[document.source_document_type])} ${escapeHtml(document.source_document_number_snapshot)}</p>` : ""}
          ${document.internal_remito_type ? `<p class="muted"><strong>Imputacion:</strong> ${escapeHtml(INTERNAL_REMITO_LABEL[document.internal_remito_type])}</p>` : ""}
          <p class="muted"><strong>Creado:</strong> ${new Date(document.created_at).toLocaleString("es-AR")}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>#</th><th>SKU</th><th>Descripcion</th><th>Cant.</th><th>Unidad</th><th>P.Unit.</th><th>Importe</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals"><div class="totals-box"><div class="totals-label">Total documento</div><div class="totals-value">$${Number(document.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div></div></div>
      <div class="notes"><strong>Notas:</strong> ${escapeHtmlWithLineBreaks(document.notes ?? "-")}</div>

      <div class="foot"><span>Generado por ${escapeHtml(companySettings.app_name)}</span><span>${escapeHtml(companySettings.document_footer ?? "Este documento no reemplaza comprobantes fiscales")}</span></div>
      </div>
      </div>
      <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
      </body></html>`);
    if (!win) return;
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para crear documentos, emitir remitos y revisar su historial." />
        ) : null}

        <PageHeader
          eyebrow="Presupuestos y remitos"
          title="Documentos"
          subtitle="Presupuestos y remitos con mejor jerarquia visual, manteniendo la misma logica de estados, impresion y transiciones."
          actions={(
            <Button onClick={openCreateDialog} disabled={!canCreateDocumentDraft(roles)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo documento
            </Button>
          )}
        />

        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente o numero..."
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="w-full md:w-52">
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as DocType | "ALL")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="PRESUPUESTO">Presupuestos</SelectItem>
                <SelectItem value="REMITO">Remitos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-52">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as DocStatus | "ALL")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
        </FilterBar>

        <DocumentsDataTable
          documents={documentsPagination.pagedItems}
          isLoading={isLoading}
          pageSize={documentsPageSize}
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
            const typedStatus = targetStatus as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO";
            if (!canTransitionDocumentTo(roles, typedStatus)) return;
            transitionMutation.mutate({ documentId, targetStatus: typedStatus });
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
              : canTransitionDocumentTo(
                  roles,
                  status as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO",
                )
          }
        />

        <DataTablePagination
          page={documentsPagination.page}
          totalPages={documentsPagination.totalPages}
          totalItems={documents.length}
          rangeStart={documentsPagination.rangeStart}
          rangeEnd={documentsPagination.rangeEnd}
          pageSize={documentsPageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setDocumentsPage}
          onPageSizeChange={(value) => setDocumentsPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
          itemLabel="documentos"
        />
      </div>

      {dialogOpen ? (
        <Suspense fallback={<DocumentsDialogLoader />}>
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
            onAddItem={addItemToDraft}
            removeLine={removeLine}
            onSubmit={() => upsertDraftMutation.mutate()}
            onResetDraftForm={resetDraftForm}
            isSubmitting={upsertDraftMutation.isPending || !canCreateDocumentDraft(roles)}
          />
        </Suspense>
      ) : null}

      {detailOpen ? (
        <Suspense fallback={<DocumentsDialogLoader />}>
          <DocumentsPreviewDialog
            open={detailOpen}
            onOpenChange={setDetailOpen}
            selectedDocument={selectedDocument}
            selectedLines={selectedLines}
            selectedEvents={selectedEvents}
            sourceDocumentLabel={sourceDocumentLabel}
            companySettings={companySettings}
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
