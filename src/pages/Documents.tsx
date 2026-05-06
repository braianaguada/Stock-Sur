import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
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
import { useSearch } from "@/hooks/useSearch";
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
import { escapeHtml, openPrintWindow } from "@/lib/print";
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
import { formatDateTime, formatIsoDate } from "@/lib/formatters";

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

function buildEmptyDocumentForm(defaultPointOfSale: number, defaultCustomerId = ""): DocumentFormState {
  return {
    doc_type: "PRESUPUESTO",
    point_of_sale: defaultPointOfSale,
    customer_id: defaultCustomerId,
    technician_id: "",
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

  const { search, deferredSearch, setSearch, trimmedSearch } = useSearch();
  const [typeFilter, setTypeFilter] = useState<DocType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsPageSize, setDocumentsPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(() =>
    buildEmptyDocumentForm(defaultPointOfSale),
  );
  const [lines, setLines] = useState<LineDraft[]>([]);

  const {
    customers,
    technicians,
    items,
    priceLists,
    availableItems,
    priceByItem,
    priceListItemByItemId,
    documents,
    isLoading,
    selectedLines,
    selectedEvents,
    selectedDocumentCashUsage,
    selectedDocument,
    sourceDocumentLabel,
  } = useDocumentsData({
    search: trimmedSearch,
    typeFilter,
    statusFilter,
    selectedDocId,
    selectedPriceListId: documentForm.price_list_id,
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
  const defaultCustomerId = useMemo(
    () => customers.find((customer) => customer.name.trim().toLowerCase() === "cliente ocasional")?.id ?? "",
    [customers],
  );

  useEffect(() => {
    setDocumentsPage(1);
  }, [trimmedSearch, typeFilter, statusFilter, documentsPageSize]);

  useEffect(() => {
    if (documentForm.price_list_id || priceLists.length === 0) return;
    setDocumentForm((previousForm) => ({ ...previousForm, price_list_id: priceLists[0].id }));
  }, [documentForm.price_list_id, priceLists]);

  useEffect(() => {
    if (documentForm.customer_id || !defaultCustomerId) return;
    setDocumentForm((previousForm) => ({ ...previousForm, customer_id: defaultCustomerId }));
  }, [defaultCustomerId, documentForm.customer_id]);

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
    if (!documentForm.price_list_id) return;

    setLines((previousLines) =>
      previousLines.map((line) => {
        if (!line.item_id) return line;
        return syncLineWithPriceList(line, priceListItemByItemId.get(line.item_id));
      }),
    );
  }, [documentForm.price_list_id, priceListItemByItemId, syncLineWithPriceList]);

  const resetDraftForm = () => {
    setEditingDocId(null);
    setDocumentForm(buildEmptyDocumentForm(defaultPointOfSale, defaultCustomerId));
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
      setDocumentForm(draft.form);
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
    cloneAsReturnMutation,
    setExternalInvoiceMutation,
    clearExternalInvoiceMutation,
  } = useDocumentsMutations({
    currentCompanyId: currentCompany?.id ?? null,
    userId: user?.id,
    documents,
    customers,
    technicians,
    lines,
    form: documentForm,
    totalDraft,
    editingDocId,
    priceByItem,
    priceListItemByItemId,
    resetDraftForm,
    setDialogOpen,
    toast,
  });

  const isBlankLine = (line: LineDraft) =>
    line.item_id === null
    && line.description.trim() === ""
    && line.quantity === EMPTY_LINE.quantity
    && line.unit_price === EMPTY_LINE.unit_price;

  const applyPickItemToLines = (draftLines: LineDraft[], index: number, itemId: string) => {
    if (!draftLines[index]) return;

    if (!itemId) {
      const current = draftLines[index];
      draftLines[index] = {
        ...current,
        item_id: null,
        sku_snapshot: "",
        unit: current.unit || "un",
        pricing_mode: "MANUAL_PRICE",
        suggested_unit_price: current.unit_price,
        base_cost_snapshot: null,
        list_flete_pct_snapshot: null,
        list_utilidad_pct_snapshot: null,
        list_impuesto_pct_snapshot: null,
        manual_margin_pct: null,
        price_overridden_by: null,
        price_overridden_at: null,
      };
      return;
    }

    const item = itemsById.get(itemId);
    if (!item) return;

    const baseLine: LineDraft = {
      ...draftLines[index],
      item_id: itemId,
      sku_snapshot: item.sku,
      description: buildItemDisplayName({
        name: item.name,
        brand: "brand" in item ? (item.brand as string | null | undefined) : null,
        model: "model" in item ? (item.model as string | null | undefined) : null,
        attributes: "attributes" in item ? (item.attributes as string | null | undefined) : null,
      }),
      unit: item.unit || "un",
      unit_price: documentForm.price_list_id ? priceByItem.get(itemId) ?? 0 : draftLines[index].unit_price,
    };

    draftLines[index] = documentForm.price_list_id
      ? syncLineWithPriceList(baseLine, priceListItemByItemId.get(itemId), true)
      : {
          ...baseLine,
          pricing_mode: "MANUAL_PRICE",
          suggested_unit_price: baseLine.unit_price,
          base_cost_snapshot: null,
          list_flete_pct_snapshot: null,
          list_utilidad_pct_snapshot: null,
          list_impuesto_pct_snapshot: null,
          manual_margin_pct: null,
          price_overridden_by: null,
          price_overridden_at: null,
        };
  };

  const onPickItem = (index: number, itemId: string) => {
    setLines((previous) => {
      const next = [...previous];
      applyPickItemToLines(next, index, itemId);
      return next;
    });
  };

  const onAddItem = (itemId: string) => {
    setLines((previous) => {
      const existingIndex = previous.findIndex((l) => l.item_id === itemId);
      if (existingIndex >= 0) {
        const next = [...previous];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: (next[existingIndex].quantity || 0) + 1,
        };
        return next;
      }

      const next = [...previous];
      const blankIndex = next.findIndex(isBlankLine);
      const index = blankIndex >= 0 ? blankIndex : next.length;
      if (index === next.length) next.push(EMPTY_LINE);
      applyPickItemToLines(next, index, itemId);
      return next;
    });
  };

  const onPriceListChange = (priceListId: string) => {
    if (priceListId === documentForm.price_list_id) return;

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

    setDocumentForm((previousForm) => ({ ...previousForm, price_list_id: priceListId }));
    setLines([]);
  };

  const removeLine = (index: number) => {
    setLines((previousLines) => previousLines.filter((_, lineIndex) => lineIndex !== index));
  };

  const printDocument = async (document: DocRow) => {
    const currency = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
    });

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

    const documentTypeLabel = DOC_LABEL[document.doc_type];
    const documentNumber = formatNumber(document.document_number, document.point_of_sale);
    const title = `${documentTypeLabel} ${documentNumber}`;
    const rows = printableLines
      .map(
        (line) => `
      <tr>
        <td class="col-idx">${line.line_order}</td>
        <td class="col-sku">${escapeHtml(line.sku_snapshot ?? "-")}</td>
        <td class="col-desc">${escapeHtml(line.description)}</td>
        <td class="col-qty">${Number(line.quantity).toLocaleString("es-AR")}</td>
        <td class="col-unit">${escapeHtml(line.unit ?? "un")}</td>
        <td class="col-money">${currency.format(Number(line.unit_price))}</td>
        <td class="col-money col-total">${currency.format(Number(line.line_total))}</td>
      </tr>
    `,
      )
      .join("");

    const logoBlock = companySettings.logo_url
      ? `<img src="${escapeHtml(companySettings.logo_url)}" alt="${escapeHtml(companySettings.app_name)}" style="max-height:110px;max-width:320px;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(15,23,42,.10))" />`
      : `<div style="font-size:30px;font-weight:800;letter-spacing:.05em;color:#0f172a">${escapeHtml(companySettings.app_name.toUpperCase())}</div>`;

    const win = openPrintWindow(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
      <style>
      @page{size:A4 portrait;margin:9mm}
      html,body{margin:0;padding:0}
      body{font-family:Arial,sans-serif;color:#0f172a;background:#eef2f7}
      .print-shell{width:192mm;max-width:192mm;margin:0 auto;padding:8mm 0}
      .sheet{border:1px solid #d6dbe3;border-radius:18px;padding:7mm 8mm;background:#fff;box-shadow:0 16px 40px rgba(15,23,42,.08);box-sizing:border-box}
      .head{display:grid;grid-template-columns:minmax(0,1.15fr) 76mm;gap:10mm;align-items:stretch;margin-bottom:8mm}
      .brand{display:flex;flex-direction:column;justify-content:space-between;min-height:42mm;padding:5mm;border-radius:14px;background:linear-gradient(135deg,#ffffff 0%,#f6f9fc 100%);border:1px solid #dbe3ee}
      .brand-copy{display:flex;flex-direction:column;gap:4mm}
      .eyebrow{display:inline-flex;width:max-content;border:1px solid #dbe3ee;border-radius:999px;background:#fff;padding:5px 10px;font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#475569}
      .muted{color:#475569;font-size:11px;line-height:1.45;margin:0}
      .brand-name{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:.02em;margin:0}
      .docbox{padding:5mm;border-radius:14px;min-width:0;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f8fafc}
      .docbox h2{margin:0 0 4mm 0;font-size:18px;line-height:1.1}
      .docline{font-size:11px;color:#dbeafe;margin:0 0 2.5mm 0;line-height:1.35}
      .docline strong,.muted strong{font-weight:700}
      .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-bottom:6mm}
      .meta-card{border:1px solid #e2e8f0;border-radius:12px;padding:4mm;background:#fff}
      .meta-title{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 2.5mm 0;font-weight:700}
      .meta-card p{margin:0 0 1.5mm 0}
      .section-title{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#64748b;margin:0 0 2.5mm 0;font-weight:700}
      table{width:100%;border-collapse:collapse;margin-top:0;border:1px solid #dbe3ee;border-radius:12px;overflow:hidden}
      th,td{padding:6px 8px;font-size:11px;border-bottom:1px solid #e8eef5;vertical-align:top}
      th{background:#eef4f8;text-align:left;color:#334155;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
      tbody tr:nth-child(even){background:#fbfdff}
      tbody tr:last-child td{border-bottom:none}
      .col-idx{width:8mm;text-align:center}
      .col-sku{width:22mm;font-family:monospace}
      .col-qty{width:13mm;text-align:right}
      .col-unit{width:14mm}
      .col-money{width:22mm;text-align:right;white-space:nowrap}
      .col-desc{width:auto}
      .col-total{font-weight:700}
      .totals{display:flex;justify-content:flex-end;margin-top:6mm}
      .totals-box{min-width:58mm;border:1px solid #dbe3ee;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%);border-radius:14px;padding:4mm 5mm}
      .totals-label{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#64748b}
      .totals-value{margin-top:2mm;font-size:22px;font-weight:800;color:#0f172a}
      .notes{margin-top:6mm;border:1px dashed #cbd5e1;border-radius:12px;padding:4mm 5mm;font-size:11px;min-height:14mm;background:#fcfcfd}
      .notes pre{margin:0;white-space:pre-wrap;font-family:inherit;line-height:1.45}
      .foot{margin-top:5mm;font-size:10px;color:#64748b;display:flex;justify-content:space-between;gap:4mm;line-height:1.4}
      .print-action{display:block;margin:14px auto 0;padding:10px 16px;border:none;border-radius:999px;background:#0f172a;color:#fff;cursor:pointer}
      .avoid-break{break-inside:avoid;page-break-inside:avoid}
      @media print{
        body{background:#fff}
        .print-shell{width:192mm;max-width:192mm;padding:0}
        .sheet{border:none;box-shadow:none;border-radius:0;padding:0}
        .print-action{display:none}
        .avoid-break{break-inside:avoid;page-break-inside:avoid}
        tr{break-inside:avoid;page-break-inside:avoid}
        thead{display:table-header-group}
        tfoot{display:table-footer-group}
      }
      </style></head><body>
      <div class="print-shell">
      <div class="sheet">
      <div class="head avoid-break">
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
          <p class="docline"><strong>Nro:</strong> ${escapeHtml(documentNumber)}</p>
          <p class="docline"><strong>Fecha:</strong> ${formatIsoDate(document.issue_date)}</p>
          <p class="docline"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[document.status])}</p>
          ${document.valid_until ? `<p class="docline"><strong>Vigencia:</strong> ${formatIsoDate(document.valid_until)}</p>` : ""}
          ${document.external_invoice_number ? `<p class="docline"><strong>Factura externa:</strong> ${escapeHtml(document.external_invoice_number)}</p>` : ""}
        </div>
      </div>

      <div class="meta-grid avoid-break">
        <div class="meta-card avoid-break">
          <p class="meta-title">Cliente</p>
          <p class="muted"><strong>Cliente:</strong> ${escapeHtml(document.customer_name ?? "Cliente ocasional")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(CUSTOMER_KIND_LABEL[document.customer_kind])}</p>
          <p class="muted"><strong>CUIT:</strong> ${escapeHtml(document.customer_tax_id ?? "-")}</p>
          <p class="muted"><strong>Condicion fiscal:</strong> ${escapeHtml(document.customer_tax_condition ?? "-")}</p>
        </div>
        <div class="meta-card avoid-break">
          <p class="meta-title">Operacion</p>
          <p class="muted"><strong>Punto de venta:</strong> ${String(document.point_of_sale).padStart(4, "0")}</p>
          <p class="muted"><strong>Tipo:</strong> ${escapeHtml(DOC_LABEL[document.doc_type])}</p>
          <p class="muted"><strong>Estado:</strong> ${escapeHtml(STATUS_LABEL[document.status])}</p>
          ${document.payment_terms ? `<p class="muted"><strong>Condicion de venta:</strong> ${escapeHtml(document.payment_terms)}</p>` : ""}
          ${document.salesperson ? `<p class="muted"><strong>Vendedor:</strong> ${escapeHtml(document.salesperson)}</p>` : ""}
          ${document.valid_until ? `<p class="muted"><strong>Valido hasta:</strong> ${formatIsoDate(document.valid_until)}</p>` : ""}
          ${document.delivery_address ? `<p class="muted"><strong>Entrega:</strong> ${escapeHtml(document.delivery_address)}</p>` : ""}
          ${document.source_document_type && document.source_document_number_snapshot ? `<p class="muted"><strong>Origen:</strong> ${escapeHtml(DOC_LABEL[document.source_document_type])} ${escapeHtml(document.source_document_number_snapshot)}</p>` : ""}
          ${document.internal_remito_type ? `<p class="muted"><strong>Imputacion:</strong> ${escapeHtml(INTERNAL_REMITO_LABEL[document.internal_remito_type])}</p>` : ""}
          <p class="muted"><strong>Creado:</strong> ${formatDateTime(document.created_at)}</p>
        </div>
      </div>

      ${document.intro_text ? `<div class="avoid-break"><p class="section-title">Observaciones</p><div class="notes"><pre>${escapeHtml(document.intro_text)}</pre></div></div>` : ""}

      <div class="avoid-break">
        <p class="section-title">Lineas</p>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>SKU</th><th>Descripcion</th><th style="text-align:right">Cant.</th><th>Un.</th><th style="text-align:right">P.Unit.</th><th style="text-align:right">Importe</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals"><div class="totals-box"><div class="totals-label">Total documento</div><div class="totals-value">$${Number(document.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</div></div></div>
      <div class="notes"><strong>Notas:</strong><pre>${escapeHtml(document.notes ?? "-")}</pre></div>

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
            const status = targetStatus as "ENVIADO" | "APROBADO" | "RECHAZADO" | "ANULADO";
            if (!canTransitionDocumentTo(roles, status)) return;
            transitionMutation.mutate({ documentId, targetStatus: status });
          }}
          onIssueRemito={(documentId) => {
            if (!canIssueRemito(roles)) return;
            issueMutation.mutate(documentId);
          }}
          onCloneAsRemito={(documentId) => {
            if (!canCloneBudgetToRemito(roles)) return;
            cloneAsRemitoMutation.mutate(documentId);
          }}
          onGenerateReturn={(documentId) => {
            cloneAsReturnMutation.mutate(documentId);
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
            documentForm={documentForm}
            setDocumentForm={setDocumentForm}
            lines={lines}
            setLines={setLines}
            totalDraft={totalDraft}
            customers={customers}
            technicians={technicians}
            priceLists={priceLists}
            availableItems={availableItems}
            onAddItem={onAddItem}
            onPriceListChange={onPriceListChange}
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
            isExternalInvoiceLocked={selectedDocumentCashUsage}
            sourceDocumentLabel={sourceDocumentLabel}
            companySettings={companySettings}
            onSetExternalInvoice={(documentId, externalInvoiceNumber) => {
              setExternalInvoiceMutation.mutate({
                documentId,
                externalInvoiceNumber,
                externalInvoiceDate: null,
              });
            }}
            onClearExternalInvoice={(documentId) => {
              clearExternalInvoiceMutation.mutate(documentId);
            }}
            isUpdatingExternalInvoice={
              setExternalInvoiceMutation.isPending || clearExternalInvoiceMutation.isPending
            }
          />
        </Suspense>
      ) : null}
    </AppLayout>
  );
}
