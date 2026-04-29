import { Edit, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, formatIsoDate } from "@/lib/formatters";
import { SERVICE_STATUS_LABEL } from "../constants";
import type { ServiceDocument, ServiceDocumentLine } from "../types";

type ServiceDocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ServiceDocument | null;
  lines: ServiceDocumentLine[];
  onEdit: (document: ServiceDocument) => void;
  onPrint: (documentId: string) => void;
};

export function ServiceDocumentPreviewDialog({
  open,
  onOpenChange,
  document,
  lines,
  onEdit,
  onPrint,
}: ServiceDocumentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,860px)] max-w-[min(96vw,1180px)] flex-col overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle className="text-lg font-semibold">Vista previa del presupuesto de servicio</DialogTitle>
        </DialogHeader>

        {document ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <section className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-primary/80 via-primary/35 to-transparent" />
                  <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.4fr)_280px]">
                    <div className="min-w-0">
                      <Badge variant="outline" className="border-primary/25 bg-primary/8 text-primary">
                        {SERVICE_STATUS_LABEL[document.status]}
                      </Badge>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight">
                        SERV-{String(document.number).padStart(6, "0")}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {document.customers?.name ?? "Sin cliente"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fecha</p>
                          <p className="mt-1 font-medium">{formatIsoDate(document.issue_date)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vigencia</p>
                          <p className="mt-1 font-medium">{document.valid_until ? formatIsoDate(document.valid_until) : "-"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Referencia</p>
                          <p className="mt-1 truncate font-medium">{document.reference || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {document.intro_text ? (
                  <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Introduccion</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{document.intro_text}</p>
                  </section>
                ) : null}

                <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Trabajos</p>
                      <p className="mt-1 text-sm text-muted-foreground">Lineas manuales de servicio.</p>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                      <p className="mt-1 text-2xl font-black">{currency.format(Number(document.total ?? 0))}</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripcion</TableHead>
                          <TableHead className="w-20 text-right">Cant.</TableHead>
                          <TableHead className="w-20">Unidad</TableHead>
                          <TableHead className="w-28 text-right">Unitario</TableHead>
                          <TableHead className="w-28 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="whitespace-pre-wrap align-top text-sm">{line.description}</TableCell>
                            <TableCell className="text-right align-top">{line.quantity ?? "-"}</TableCell>
                            <TableCell className="align-top">{line.unit ?? "-"}</TableCell>
                            <TableCell className="text-right align-top">{line.unit_price != null ? currency.format(Number(line.unit_price)) : "-"}</TableCell>
                            <TableCell className="text-right align-top font-semibold">{currency.format(Number(line.line_total ?? 0))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                <section className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Plazo de entrega</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{document.delivery_time || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Condiciones de pago</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{document.payment_terms || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lugar de entrega</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{document.delivery_location || "-"}</p>
                  </div>
                </section>

                {document.closing_text ? (
                  <section className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cierre</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{document.closing_text}</p>
                  </section>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-3">
              <Button type="button" variant="outline" onClick={() => onPrint(document.id)}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
              </Button>
              <Button type="button" disabled={document.status !== "DRAFT"} onClick={() => onEdit(document)}>
                <Edit className="mr-2 h-4 w-4" /> Editar borrador
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground">
            Cargando presupuesto...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
