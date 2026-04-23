import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Copy, Eye, FileDown, Pencil, Send } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DOC_LABEL, DOC_TYPE_CLASS, STATUS_CLASS, STATUS_LABEL, STATUS_VARIANT } from "@/features/documents/constants";
import type { DocRow, DocStatus } from "@/features/documents/types";
import { formatNumber } from "@/features/documents/utils";
import { formatBusinessDate } from "@/lib/formatters";

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
  canPrintDocument: boolean;
  canEditDocumentDraft: boolean;
  canIssueRemito: boolean;
  canCloneBudgetToRemito: boolean;
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
  canPrintDocument,
  canEditDocumentDraft,
  canIssueRemito,
  canCloneBudgetToRemito,
  canTransitionDocumentTo,
}: DocumentsDataTableProps) {
  const columns = useMemo<ColumnDef<DocRow, unknown>[]>(() => [
    {
      accessorKey: "doc_type",
      header: () => "Tipo",
      cell: ({ row }) => (
        <Badge variant="outline" className={DOC_TYPE_CLASS[row.original.doc_type]}>
          {DOC_LABEL[row.original.doc_type]}
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
      cell: ({ row }) => (
        <span className="block truncate font-medium">{row.original.customer_name ?? "Cliente ocasional"}</span>
      ),
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
      cell: ({ row }) => formatBusinessDate(row.original.issue_date),
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
          <div className="flex flex-nowrap items-center justify-start gap-1.5 overflow-hidden">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onOpenDetail(doc.id)} title="Ver">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onPrint(doc)} title="Imprimir / PDF" disabled={!canPrintDocument}>
              <FileDown className="h-4 w-4" />
            </Button>
            {doc.status === "BORRADOR" && canEditDocumentDraft ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onEditDraft(doc.id)} title="Editar borrador">
                <Pencil className="h-4 w-4 text-blue-600" />
              </Button>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ENVIADO")} title="Marcar como enviado" disabled={!canTransitionDocumentTo("ENVIADO")}>
                  <Send className="h-4 w-4 text-blue-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Send className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <Ban className="h-4 w-4 text-amber-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "ENVIADO" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Send className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <Ban className="h-4 w-4 text-amber-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "REMITO" && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onIssueRemito(doc.id)} title="Emitir remito" disabled={!canIssueRemito}>
                  <Send className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular borrador" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" ? (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onCloneAsRemito(doc.id)} title="Convertir a remito" disabled={!canCloneBudgetToRemito}>
                  <Copy className="h-4 w-4 text-blue-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              </>
            ) : null}
            {doc.doc_type === "REMITO" && doc.status === "EMITIDO" ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular remito" disabled={!canTransitionDocumentTo("ANULADO")}>
                <Ban className="h-4 w-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        );
      },
      meta: {
        className: "w-[320px]",
        cellClassName: "py-2.5",
      },
    },
  ], [
    canCloneBudgetToRemito,
    canEditDocumentDraft,
    canIssueRemito,
    canPrintDocument,
    canTransitionDocumentTo,
    onCloneAsRemito,
    onEditDraft,
    onIssueRemito,
    onOpenDetail,
    onPrint,
    onTransition,
  ]);

  return (
    <div className="data-panel">
      <DataTable
        columns={columns}
        data={documents}
        isLoading={isLoading}
        emptyMessage="Sin documentos"
        className="table-fixed"
        rowClassName="h-11"
        cellClassName="h-11 py-0"
        reserveEmptyRows={pageSize}
        stickyHeader
      />
    </div>
  );
}

