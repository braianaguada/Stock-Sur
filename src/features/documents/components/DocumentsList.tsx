import { Ban, Copy, Eye, FileDown, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DOC_LABEL, DOC_TYPE_CLASS, STATUS_LABEL, STATUS_VARIANT } from "@/features/documents/constants";
import type { DocRow, DocStatus } from "@/features/documents/types";
import { formatNumber } from "@/features/documents/utils";

interface DocumentsListProps {
  documents: DocRow[];
  isLoading: boolean;
  onOpenDetail: (documentId: string) => void;
  onPrint: (document: DocRow) => void;
  onEditDraft: (documentId: string) => void;
  onTransition: (documentId: string, status: DocStatus) => void;
  onIssueRemito: (documentId: string) => void;
  onCloneAsRemito: (documentId: string) => void;
}

export function DocumentsList({
  documents,
  isLoading,
  onOpenDetail,
  onPrint,
  onEditDraft,
  onTransition,
  onIssueRemito,
  onCloneAsRemito,
}: DocumentsListProps) {
  return (
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
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando...</TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin documentos</TableCell>
            </TableRow>
          ) : documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <Badge variant="outline" className={DOC_TYPE_CLASS[doc.doc_type]}>
                  {DOC_LABEL[doc.doc_type]}
                </Badge>
              </TableCell>
              <TableCell className="font-mono">{formatNumber(doc.document_number, doc.point_of_sale)}</TableCell>
              <TableCell className="font-medium">{doc.customer_name ?? "Cliente ocasional"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">${Number(doc.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
              <TableCell>{new Date(doc.issue_date).toLocaleDateString("es-AR")}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onOpenDetail(doc.id)} title="Ver">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onPrint(doc)} title="Imprimir / PDF">
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {doc.status === "BORRADOR" && (
                    <Button variant="ghost" size="icon" onClick={() => onEditDraft(doc.id)} title="Editar borrador">
                      <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                  )}
                  {doc.doc_type === "PRESUPUESTO" && doc.status === "BORRADOR" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ENVIADO")} title="Marcar como enviado">
                        <Send className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar">
                        <Send className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar">
                        <Ban className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular">
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {doc.doc_type === "PRESUPUESTO" && doc.status === "ENVIADO" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "APROBADO")} title="Aprobar">
                        <Send className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "RECHAZADO")} title="Rechazar">
                        <Ban className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular">
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {doc.doc_type === "REMITO" && doc.status === "BORRADOR" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onIssueRemito(doc.id)} title="Emitir remito">
                        <Send className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular borrador">
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {doc.doc_type === "PRESUPUESTO" && doc.status === "APROBADO" && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onCloneAsRemito(doc.id)} title="Convertir a remito">
                        <Copy className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular">
                        <Ban className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                  {doc.doc_type === "REMITO" && doc.status === "EMITIDO" && (
                    <Button variant="ghost" size="icon" onClick={() => onTransition(doc.id, "ANULADO")} title="Anular remito">
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
  );
}
