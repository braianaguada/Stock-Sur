import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Edit, Eye, Plus, Printer, Search, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { currency, todayBusinessDateInputValue, formatIsoDate } from "@/lib/formatters";
import { EMPTY_SERVICE_LINE, DEFAULT_SERVICE_TEXTS, SERVICE_STATUS_LABEL } from "@/features/services/constants";
import { ServiceDocumentPreviewDialog } from "@/features/services/components/ServiceDocumentPreviewDialog";
import { serviceDb } from "@/features/services/db";
import { calculateServiceLineTotal, useServiceDocumentMutations } from "@/features/services/hooks/useServiceDocumentMutations";
import { useServiceDocuments } from "@/features/services/hooks/useServiceDocuments";
import { openServiceDocumentPrintWindow } from "@/features/services/print";
import type { ServiceDocument, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentStatus } from "@/features/services/types";

const STATUS_OPTIONS: Array<ServiceDocumentStatus | "ALL"> = ["ALL", "DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED"];

function buildInitialForm(settings: ReturnType<typeof useCompanyBrand>["settings"]): ServiceDocumentForm {
  return {
    customer_id: "",
    status: "DRAFT",
    reference: "",
    issue_date: todayBusinessDateInputValue(),
    valid_until: "",
    intro_text: settings.document_tagline || DEFAULT_SERVICE_TEXTS.intro_text,
    delivery_time: DEFAULT_SERVICE_TEXTS.delivery_time,
    payment_terms: DEFAULT_SERVICE_TEXTS.payment_terms,
    delivery_location: settings.address || DEFAULT_SERVICE_TEXTS.delivery_location,
    closing_text: settings.document_footer || DEFAULT_SERVICE_TEXTS.closing_text,
    currency: "ARS",
  };
}

export default function ServiceDocumentsPage() {
  const { currentCompany, user } = useAuth();
  const { settings } = useCompanyBrand();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState<ServiceDocumentStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceDocumentForm>(() => buildInitialForm(settings));
  const [lines, setLines] = useState<ServiceDocumentLine[]>([{ ...EMPTY_SERVICE_LINE }]);

  const { customers, documents, selectedDocument, selectedLines, isLoading } = useServiceDocuments({
    companyId: currentCompany?.id ?? null,
    search: deferredSearch,
    status,
    documentId: editingDocumentId ?? previewDocumentId,
  });

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + calculateServiceLineTotal(line), 0),
    [lines],
  );

  useEffect(() => {
    if (!selectedDocument || !editingDocumentId) return;
    setForm({
      customer_id: selectedDocument.customer_id ?? "",
      status: selectedDocument.status,
      reference: selectedDocument.reference ?? "",
      issue_date: selectedDocument.issue_date,
      valid_until: selectedDocument.valid_until ?? "",
      intro_text: selectedDocument.intro_text ?? "",
      delivery_time: selectedDocument.delivery_time ?? "",
      payment_terms: selectedDocument.payment_terms ?? "",
      delivery_location: selectedDocument.delivery_location ?? "",
      closing_text: selectedDocument.closing_text ?? "",
      currency: selectedDocument.currency ?? "ARS",
    });
    setLines(selectedLines.length > 0 ? selectedLines : [{ ...EMPTY_SERVICE_LINE }]);
  }, [editingDocumentId, selectedDocument, selectedLines]);

  const resetForm = () => {
    setEditingDocumentId(null);
    setForm(buildInitialForm(settings));
    setLines([{ ...EMPTY_SERVICE_LINE }]);
  };

  const { upsertMutation } = useServiceDocumentMutations({
    companyId: currentCompany?.id ?? null,
    userId: user?.id,
    editingDocumentId,
    form,
    lines,
    toast,
    onDone: () => {
      setDialogOpen(false);
      resetForm();
    },
  });

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (document: ServiceDocument) => {
    if (document.status !== "DRAFT") return;
    setPreviewOpen(false);
    setPreviewDocumentId(null);
    setEditingDocumentId(document.id);
    setDialogOpen(true);
  };

  const openPreview = (documentId: string) => {
    setEditingDocumentId(null);
    setPreviewDocumentId(documentId);
    setPreviewOpen(true);
  };

  const openPrint = async (documentId: string) => {
    try {
      const { data: documentData, error: documentError } = await serviceDb
        .from("service_documents")
        .select("*, customers(id, name, cuit, email, phone)")
        .eq("id", documentId)
        .single();
      if (documentError) throw documentError;

      const { data: linesData, error: linesError } = await serviceDb
        .from("service_document_lines")
        .select("*")
        .eq("document_id", documentId)
        .order("sort_order");
      if (linesError) throw linesError;

      const win = openServiceDocumentPrintWindow({
        document: documentData as ServiceDocument,
        lines: (linesData ?? []) as ServiceDocumentLine[],
        settings,
      });

      if (!win) {
        window.open(`/print/service-document/${documentId}`, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "No se pudo imprimir",
        description: "Reintentá en unos segundos o abrí el detalle del presupuesto.",
        variant: "destructive",
      });
    }
  };

  const updateLine = (index: number, patch: Partial<ServiceDocumentLine>) => {
    setLines((previous) =>
      previous.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...patch };
        return { ...next, line_total: calculateServiceLineTotal(next) };
      }),
    );
  };

  const removeLine = (index: number) => {
    setLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index));
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <CompanyAccessNotice description="Necesitas una empresa activa para crear presupuestos de servicio." />
        ) : null}

        <PageHeader
          eyebrow="Servicios"
          title="Documentos"
          subtitle="Presupuestos de servicio manuales, separados de stock, caja e items."
          actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto</Button>}
        />

        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente, numero o referencia..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <Select value={status} onValueChange={(value) => setStatus(value as ServiceDocumentStatus | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>{option === "ALL" ? "Todos" : SERVICE_STATUS_LABEL[option]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        <section className="data-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : documents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sin presupuestos de servicio</TableCell></TableRow>
              ) : documents.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">SERV-{String(document.number).padStart(6, "0")}</TableCell>
                  <TableCell>{document.customers?.name ?? "Sin cliente"}</TableCell>
                  <TableCell>{formatIsoDate(document.issue_date)}</TableCell>
                  <TableCell><Badge variant="outline">{SERVICE_STATUS_LABEL[document.status]}</Badge></TableCell>
                  <TableCell className="text-right">{currency.format(Number(document.total ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="icon" title="Ver detalle" onClick={() => openPreview(document.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" title="Imprimir" onClick={() => openPrint(document.id)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" title="Editar" disabled={document.status !== "DRAFT"} onClick={() => openEdit(document)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1180px)] overflow-y-auto p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-3">
            <DialogTitle className="text-lg">{editingDocumentId ? "Editar presupuesto de servicio" : "Nuevo presupuesto de servicio"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-4">
            <section className="grid gap-3 rounded-xl border border-border/60 bg-card/60 p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label className="text-xs">Cliente</Label>
                <Select value={form.customer_id} onValueChange={(value) => setForm((current) => ({ ...current, customer_id: value }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                  <SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Referencia</Label><Input className="h-9" value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></div>
              <div><Label className="text-xs">Fecha</Label><Input className="h-9" type="date" value={form.issue_date} onChange={(event) => setForm((current) => ({ ...current, issue_date: event.target.value }))} /></div>
              <div><Label className="text-xs">Vigencia</Label><Input className="h-9" type="date" value={form.valid_until} onChange={(event) => setForm((current) => ({ ...current, valid_until: event.target.value }))} /></div>
              <div><Label className="text-xs">Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ServiceDocumentStatus }))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.filter((option) => option !== "ALL").map((option) => <SelectItem key={option} value={option}>{SERVICE_STATUS_LABEL[option]}</SelectItem>)}</SelectContent></Select></div>
            </section>

            <section className="grid gap-3">
              <Label className="text-xs">Texto introductorio</Label>
              <Textarea className="min-h-20" rows={3} value={form.intro_text} onChange={(event) => setForm((current) => ({ ...current, intro_text: event.target.value }))} />
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Descripcion</TableHead><TableHead className="w-24">Cantidad</TableHead><TableHead className="w-24">Unidad</TableHead><TableHead className="w-28">Precio</TableHead><TableHead className="w-28 text-right">Total</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                  <TableBody>{lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="py-2"><Textarea className="min-h-16 resize-y" rows={2} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></TableCell>
                      <TableCell className="py-2"><Input className="h-9" type="number" min="0" step="0.001" value={line.quantity ?? ""} onChange={(event) => updateLine(index, { quantity: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-2"><Input className="h-9" value={line.unit ?? ""} onChange={(event) => updateLine(index, { unit: event.target.value })} /></TableCell>
                      <TableCell className="py-2"><Input className="h-9" type="number" min="0" step="0.01" value={line.unit_price ?? ""} onChange={(event) => updateLine(index, { unit_price: event.target.value ? Number(event.target.value) : null })} /></TableCell>
                      <TableCell className="py-2 text-right font-medium">{currency.format(calculateServiceLineTotal(line))}</TableCell>
                      <TableCell className="py-2"><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeLine(index)} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
              <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setLines((current) => [...current, { ...EMPTY_SERVICE_LINE, sort_order: current.length + 1 }])}><Plus className="mr-2 h-4 w-4" /> Agregar linea</Button>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
              <div><Label className="text-xs">Plazo de entrega</Label><Textarea className="min-h-20" rows={3} value={form.delivery_time} onChange={(event) => setForm((current) => ({ ...current, delivery_time: event.target.value }))} /></div>
              <div><Label className="text-xs">Condiciones de pago</Label><Textarea className="min-h-20" rows={3} value={form.payment_terms} onChange={(event) => setForm((current) => ({ ...current, payment_terms: event.target.value }))} /></div>
              <div><Label className="text-xs">Lugar de entrega</Label><Textarea className="min-h-20" rows={3} value={form.delivery_location} onChange={(event) => setForm((current) => ({ ...current, delivery_location: event.target.value }))} /></div>
            </section>

            <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div><Label className="text-xs">Cierre</Label><Textarea className="min-h-20" rows={3} value={form.closing_text} onChange={(event) => setForm((current) => ({ ...current, closing_text: event.target.value }))} /></div>
              <div className="self-end rounded-lg border bg-muted/30 p-4">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{currency.format(total)}</span></div>
                <div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span>{currency.format(total)}</span></div>
              </div>
            </section>
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/20 px-5 py-3">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={() => upsertMutation.mutate()} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceDocumentPreviewDialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewDocumentId(null);
        }}
        document={previewDocumentId ? selectedDocument : null}
        lines={previewDocumentId ? selectedLines : []}
        onEdit={openEdit}
        onPrint={openPrint}
      />
    </AppLayout>
  );
}
