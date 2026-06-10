import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Check, Copy, Eye, FileText, Loader2, Pencil, Printer, RotateCcw, Send, X } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOC_LABEL, DOC_TYPE_CLASS, STATUS_CLASS, STATUS_LABEL, STATUS_VARIANT } from "@/features/documents/constants";
import { canDuplicateDocumentType } from "@/features/documents/lib/duplicate";
import type { DocRow, DocStatus } from "@/features/documents/types";
import { formatNumber, resolveDocumentRecipient } from "@/features/documents/utils";
import { formatIsoDate } from "@/lib/formatters";

interface DocumentsDataTableProps {
  documents: DocRow[];
  isLoading: boolean;
  pageSize: number;
  onOpenDetail: (documentId: string) => void;
  onPrint: (document: DocRow) => void;
  onEditDraft: (documentId: string) => void;
  onTransition: (documentId: string, status: DocStatus) => void;
  onIssueRemito: (documentId: string) => void;
  onCloneAsRemito: (documentId: string) => void;
  onDuplicateDocument: (documentId: string) => void;
  onGenerateReturn: (documentId: string) => void;
  isIssuingDocument: boolean;
  canPrintDocument: boolean;
  canEditDocumentDraft: boolean;
  canIssueRemito: boolean;
  canCloneBudgetToRemito: boolean;
  canDuplicateDocument: boolean;
  canTransitionDocumentTo: (status: DocStatus) => boolean;
}

export function DocumentsDataTable({
  documents,
  isLoading,
  pageSize,
  onOpenDetail,
  onPrint,
  onEditDraft,
  onTransition,
  onIssueRemito,
  onCloneAsRemito,
  onDuplicateDocument,
  onGenerateReturn,
  isIssuingDocument,
  canPrintDocument,
  canEditDocumentDraft,
  canIssueRemito,
  canCloneBudgetToRemito,
  canDuplicateDocument,
  canTransitionDocumentTo,
}: DocumentsDataTableProps) {
  const columns = useMemo<ColumnDef<DocRow, unknown>[]>(() => [
    {
      accessorKey: "doc_type",
      header: () => "Tipo",
      cell: ({ row }) => (
        <Badge variant="outline" className={DOC_TYPE_CLASS[row.original.doc_type]}>
          {row.original.doc_type === "REMITO_DEVOLUCION" ? "Devolucion" : DOC_LABEL[row.original.doc_type]}
        </Badge>
      ),
      meta: {
        className: "w-[120px]",
        cellClassName: "py-2.5",
      },
    },
    {
      accessorKey: "document_number",
      header: () => "Número",
      cell: ({ row }) => (
        <span className="block whitespace-nowrap font-mono tabular-nums">
          {formatNumber(row.original.document_number, row.original.point_of_sale)}
        </span>
      ),
      meta: {
        className: "w-[150px]",
        cellClassName: "py-2.5",
      },
    },
    {
      accessorKey: "customer_name",
      header: () => "Cliente",
      cell: ({ row }) => {
        const recipient = resolveDocumentRecipient(row.original);
        return <div className="min-w-0">
          <span className="block truncate font-medium">{recipient.primaryName}</span>
          {recipient.secondaryName ? <span className="block truncate text-xs text-muted-foreground">{recipient.secondaryName}</span> : null}
        </div>;
      },
      meta: {
        className: "w-[220px]",
        cellClassName: "py-2.5",
      },
    },
    {
      accessorKey: "status",
      header: () => "Estado",
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant={STATUS_VARIANT[row.original.status]} className={STATUS_CLASS[row.original.status]}>
            {STATUS_LABEL[row.original.status]}
          </Badge>
          {row.original.doc_type === "REMITO" && row.original.external_invoice_status === "ACTIVE" ? (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              Factura: {row.original.external_invoice_number}
            </p>
          ) : null}
        </div>
      ),
      meta: {
        cellClassName: "py-2.5",
      },
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          ${Number(row.original.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
      meta: {
        className: "w-[140px]",
        cellClassName: "py-2.5",
      },
    },
    {
      accessorKey: "issue_date",
      header: () => "Fecha",
      cell: ({ row }) => formatIsoDate(row.original.issue_date),
      meta: {
        className: "w-[120px]",
        cellClassName: "py-2.5",
      },
    },
    {
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex flex-nowrap items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-sky-500 hover:text-sky-400" onClick={() => onOpenDetail(doc.id)} title="Ver">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-violet-500 hover:text-violet-400" onClick={() => onPrint(doc)} title="Imprimir / PDF" disabled={!canPrintDocument}>
              <Printer className="h-4 w-4" />
            </Button>
            {doc.status === "BORRADOR" && canEditDocumentDraft ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-amber-500 hover:text-amber-400" onClick={() => onEditDraft(doc.id)} title="Editar borrador">
                <Pencil className="h-4 w-4" />
              </Button>
            ) : null}
            {canDuplicateDocumentType(doc.doc_type) ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-indigo-500 hover:text-indigo-400" onClick={() => onDuplicateDocument(doc.id)} title="Duplicar" disabled={!canDuplicateDocument}>
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-cyan-500 hover:text-cyan-400" onClick={() => onTransition(doc.id, "ENVIADO")} title="Marcar como enviado" disabled={!canTransitionDocumentTo("ENVIADO")}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-500 hover:text-emerald-400" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-rose-500 hover:text-rose-400" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-400" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "ENVIADO" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-emerald-500 hover:text-emerald-400" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-rose-500 hover:text-rose-400" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-400" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {(doc.doc_type === "REMITO" || doc.doc_type === "REMITO_DEVOLUCION") && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-cyan-500 hover:text-cyan-400" onClick={() => onIssueRemito(doc.id)} title={doc.doc_type === "REMITO_DEVOLUCION" ? "Emitir devolucion" : "Emitir remito"} disabled={!canIssueRemito || isIssuingDocument}>
                  {isIssuingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-400" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular borrador" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-violet-500 hover:text-violet-400" onClick={() => onCloneAsRemito(doc.id)} title="Convertir a remito" disabled={!canCloneBudgetToRemito}>
                <FileText className="h-4 w-4" />
              </Button>
            ) : null}
            {doc.doc_type === "REMITO" && doc.status === "EMITIDO" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-cyan-500 hover:text-cyan-400" onClick={() => onGenerateReturn(doc.id)} title="Generar devolución">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-400" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular remito" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "REMITO_DEVOLUCION" && doc.status === "EMITIDO" ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-400" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular devolucion" disabled={!canTransitionDocumentTo("ANULADO")}>
                <Ban className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: {
        className: "w-[360px] min-w-[360px] text-right",
        cellClassName: "py-2.5 whitespace-nowrap",
      },
    },
  ], [
    canCloneBudgetToRemito,
    canEditDocumentDraft,
    canIssueRemito,
    canDuplicateDocument,
    isIssuingDocument,
    canPrintDocument,
    canTransitionDocumentTo,
    onGenerateReturn,
    onEditDraft,
    onIssueRemito,
    onOpenDetail,
    onPrint,
    onTransition,
    onCloneAsRemito,
    onDuplicateDocument,
  ]);

  return (
    <div className="data-panel overflow-x-auto">
      <DataTable
        columns={columns}
        data={documents}
        isLoading={isLoading}
        emptyMessage="No hay documentos para mostrar"
        className="table-fixed"
        rowClassName="h-11"
        cellClassName="h-11 py-0"
        reserveEmptyRows={pageSize}
      />
    </div>
  );
}
