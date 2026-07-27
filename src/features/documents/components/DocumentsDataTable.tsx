import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Banknote, Check, Copy, Eye, FileText, Loader2, MessageCircle, MoreHorizontal, Pencil, Printer, RotateCcw, Send, X } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CategoryBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogActionGrid, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DOC_LABEL, INTERNAL_REMITO_LABEL, STATUS_LABEL } from "@/features/documents/constants";
import { canDuplicateDocumentType } from "@/features/documents/lib/duplicate";
import type { DocRow, DocStatus } from "@/features/documents/types";
import { formatNumber, resolveDocumentRecipient } from "@/features/documents/utils";
import { formatBusinessDate } from "@/lib/formatters";

const STATUS_TONE: Record<DocStatus, "muted" | "info" | "success" | "danger"> = {
  BORRADOR: "muted",
  ENVIADO: "info",
  APROBADO: "success",
  RECHAZADO: "danger",
  EMITIDO: "success",
  ANULADO: "danger",
};

interface DocumentsDataTableProps {
  documents: DocRow[];
  isLoading: boolean;
  pageSize: number;
  technicianNamesById?: Map<string, string>;
  onOpenDetail: (documentId: string) => void;
  onPrint: (document: DocRow) => void;
  onShare: (document: DocRow) => void;
  onEditDraft: (documentId: string) => void;
  onTransition: (documentId: string, status: DocStatus) => void;
  onIssueRemito: (documentId: string) => void;
  onCloneAsRemito: (documentId: string) => void;
  onDuplicateDocument: (documentId: string) => void;
  onGenerateReturn: (documentId: string) => void;
  onRegisterInCash: (document: DocRow) => void;
  cashRegisteredDocumentIds: Set<string>;
  isIssuingDocument: boolean;
  canPrintDocument: boolean;
  canEditDocumentDraft: boolean;
  canIssueRemito: boolean;
  canCloneBudgetToRemito: boolean;
  canDuplicateDocument: boolean;
  canRegisterInCash: boolean;
  canTransitionDocumentTo: (status: DocStatus) => boolean;
}
export function DocumentsDataTable({
  documents,
  isLoading,
  pageSize,
  technicianNamesById = new Map(),
  onOpenDetail,
  onPrint,
  onShare,
  onEditDraft,
  onTransition,
  onIssueRemito,
  onCloneAsRemito,
  onDuplicateDocument,
  onGenerateReturn,
  onRegisterInCash,
  cashRegisteredDocumentIds,
  isIssuingDocument,
  canPrintDocument,
  canEditDocumentDraft,
  canIssueRemito,
  canCloneBudgetToRemito,
  canDuplicateDocument,
  canRegisterInCash,
  canTransitionDocumentTo,
}: DocumentsDataTableProps) {
  const columns = useMemo<ColumnDef<DocRow, unknown>[]>(() => [
    {
      accessorKey: "doc_type",
      header: () => "Tipo",
      cell: ({ row }) => (
        <CategoryBadge>
          {row.original.doc_type === "REMITO_DEVOLUCION" ? "Devolucion" : DOC_LABEL[row.original.doc_type]}
        </CategoryBadge>
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
        const metadata = row.original.customer_kind === "INTERNO" && row.original.internal_remito_type ? (
            <>
              <span className="block truncate">
                Tecnico: {row.original.technician_id ? technicianNamesById.get(row.original.technician_id) ?? "Tecnico eliminado" : "-"}
              </span>
              <span className="block truncate">{INTERNAL_REMITO_LABEL[row.original.internal_remito_type]}</span>
            </>
          ) : recipient.secondaryName;
        return <PrimaryCell title={recipient.primaryName} metadata={metadata} />;
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
          <StatusBadge tone={STATUS_TONE[row.original.status]}>
            {STATUS_LABEL[row.original.status]}
          </StatusBadge>
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
        <MoneyCell value={Number(row.original.total)} />
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
          <RowActions>
            <RowActionButton label="Ver detalle" tone="view" onClick={() => onOpenDetail(doc.id)}>
              <Eye className="h-4 w-4" />
            </RowActionButton>
            {doc.doc_type === "REMITO" && doc.status === "EMITIDO" && cashRegisteredDocumentIds.has(doc.id) ? (
              <StatusBadge tone="success">
                Registrado en Caja
              </StatusBadge>
            ) : doc.doc_type === "REMITO" && doc.status === "EMITIDO" && canRegisterInCash ? (
              <Button variant="outline" size="sm" className="h-10 whitespace-nowrap" onClick={() => onRegisterInCash(doc)}>
                <Banknote className="mr-1.5 h-4 w-4" />
                Registrar en Caja
              </Button>
            ) : null}
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-lg" aria-label="Más acciones" title="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="domain-commercial sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Acciones del documento</DialogTitle>
                  <DialogDescription>Elegí una acción para {doc.document_number ?? "este documento"}.</DialogDescription>
                </DialogHeader>
                <DialogActionGrid columns={2}>
            <Button variant="ghost" onClick={() => onPrint(doc)} disabled={!canPrintDocument}>
              <Printer className="h-4 w-4" /><span>Imprimir / PDF</span>
            </Button>
            <Button variant="ghost" onClick={() => onShare(doc)}>
              <MessageCircle className="h-4 w-4" /><span>Compartir</span>
            </Button>
            {doc.status === "BORRADOR" && canEditDocumentDraft ? (
              <Button variant="ghost" onClick={() => onEditDraft(doc.id)}>
                <Pencil className="h-4 w-4" /><span>Editar borrador</span>
              </Button>
            ) : null}
            {canDuplicateDocumentType(doc.doc_type) ? (
              <Button variant="ghost" onClick={() => onDuplicateDocument(doc.id)} disabled={!canDuplicateDocument}>
                <Copy className="h-4 w-4" /><span>Duplicar</span>
              </Button>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" className="text-[hsl(var(--domain-accent-strong))] hover:bg-[hsl(var(--domain-accent))]/10 hover:text-[hsl(var(--domain-accent-strong))]" onClick={() => onTransition(doc.id, "ENVIADO")} title="Marcar como enviado" disabled={!canTransitionDocumentTo("ENVIADO")}>
                  <Send className="h-4 w-4" /><span>Marcar enviado</span>
                </Button>
                <Button variant="ghost" className="text-success hover:bg-success/10 hover:text-success" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Check className="h-4 w-4" /><span>Aprobar</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <X className="h-4 w-4" /><span>Rechazar</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" /><span>Anular</span>
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "ENVIADO" ? (
              <>
                <Button variant="ghost" className="text-success hover:bg-success/10 hover:text-success" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar" disabled={!canTransitionDocumentTo("APROBADO")}>
                  <Check className="h-4 w-4" /><span>Aprobar</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar" disabled={!canTransitionDocumentTo("RECHAZADO")}>
                  <X className="h-4 w-4" /><span>Rechazar</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" /><span>Anular</span>
                </Button>
              </>
            ) : null}
            {(doc.doc_type === "REMITO" || doc.doc_type === "REMITO_DEVOLUCION") && doc.status === "BORRADOR" ? (
              <>
                <Button variant="ghost" className="text-[hsl(var(--domain-accent-strong))] hover:bg-[hsl(var(--domain-accent))]/10 hover:text-[hsl(var(--domain-accent-strong))]" onClick={() => onIssueRemito(doc.id)} title={doc.doc_type === "REMITO_DEVOLUCION" ? "Emitir devolucion" : "Emitir remito"} disabled={!canIssueRemito || isIssuingDocument}>
                  {isIssuingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span>{doc.doc_type === "REMITO_DEVOLUCION" ? "Emitir devolución" : "Emitir remito"}</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular borrador" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" /><span>Anular borrador</span>
                </Button>
              </>
            ) : null}
            {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" ? (
              <Button variant="ghost" className="text-[hsl(var(--domain-accent-strong))] hover:bg-[hsl(var(--domain-accent))]/10 hover:text-[hsl(var(--domain-accent-strong))]" onClick={() => onCloneAsRemito(doc.id)} title="Convertir a remito" disabled={!canCloneBudgetToRemito}>
                <FileText className="h-4 w-4" /><span>Convertir a remito</span>
              </Button>
            ) : null}
            {doc.doc_type === "REMITO" && doc.status === "EMITIDO" ? (
              <>
                <Button variant="ghost" className="text-[hsl(var(--domain-accent-strong))] hover:bg-[hsl(var(--domain-accent))]/10 hover:text-[hsl(var(--domain-accent-strong))]" onClick={() => onGenerateReturn(doc.id)} title="Generar devolución">
                  <RotateCcw className="h-4 w-4" /><span>Generar devolución</span>
                </Button>
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular remito" disabled={!canTransitionDocumentTo("ANULADO")}>
                  <Ban className="h-4 w-4" /><span>Anular remito</span>
                </Button>
              </>
            ) : null}
            {doc.doc_type === "REMITO_DEVOLUCION" && doc.status === "EMITIDO" ? (
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular devolucion" disabled={!canTransitionDocumentTo("ANULADO")}>
                <Ban className="h-4 w-4" /><span>Anular devolución</span>
              </Button>
            ) : null}
                </DialogActionGrid>
              </DialogContent>
            </Dialog>
          </RowActions>
        );
      },
      meta: {
        className: "w-[190px] min-w-[190px] text-right",
        cellClassName: "py-2.5 whitespace-nowrap",
      },
    },
  ], [
    canCloneBudgetToRemito,
    canEditDocumentDraft,
    canIssueRemito,
    canDuplicateDocument,
    canRegisterInCash,
    cashRegisteredDocumentIds,
    isIssuingDocument,
    canPrintDocument,
    canTransitionDocumentTo,
    onGenerateReturn,
    onRegisterInCash,
    onEditDraft,
    onIssueRemito,
    onOpenDetail,
    onPrint,
    onShare,
    onTransition,
    onCloneAsRemito,
    onDuplicateDocument,
    technicianNamesById,
  ]);

  return (
    <Card className="min-w-0 overflow-x-auto border-border/70 shadow-none">
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
    </Card>
  );
}
