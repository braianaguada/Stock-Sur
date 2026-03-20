import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, FileDown, X } from "lucide-react";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/features/quotes/constants";
import { useQuotesFlow } from "@/features/quotes/hooks/useQuotesFlow";
import type { QuoteLine } from "@/features/quotes/types";

export default function QuotesPage() {
  const { settings } = useCompanyBrand();
  const { toast } = useToast();
  const { user, currentCompany } = useAuth();
  const {
    addLine,
    currentCompanyId,
    customers,
    deleteMutation,
    detailDialogOpen,
    dialogOpen,
    exportPDF,
    form,
    isLoading,
    lines,
    openCreate,
    quoteLines,
    quoteToDelete,
    quotes,
    removeLine,
    saveMutation,
    search,
    selectedQuoteId,
    setDetailDialogOpen,
    setDialogOpen,
    setForm,
    setQuoteToDelete,
    setSearch,
    setSelectedQuoteId,
    updateLine,
  } = useQuotesFlow({
    appName: settings.app_name,
    currentCompanyId: currentCompany?.id ?? null,
    userId: user?.id ?? null,
    toast,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Presupuestos</h1>
            <p className="text-muted-foreground">Crear y exportar presupuestos</p>
          </div>
          <Button onClick={openCreate} disabled={!currentCompanyId}><Plus className="mr-2 h-4 w-4" /> Nuevo presupuesto</Button>
        </div>

        {!currentCompanyId ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            Selecciona una empresa activa para ver y crear presupuestos.
          </div>
        ) : null}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o numero..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={!currentCompanyId}
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : quotes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No hay presupuestos</TableCell></TableRow>
              ) : quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-mono">{quote.quote_number}</TableCell>
                  <TableCell className="font-medium">{quote.customer_name ?? quote.customers?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={QUOTE_STATUS_VARIANTS[quote.status] ?? "secondary"}>
                      {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${Number(quote.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(quote.created_at).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedQuoteId(quote.id); setDetailDialogOpen(true); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => exportPDF(quote)}><FileDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setQuoteToDelete(quote)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
          <DialogHeader><DialogTitle>Nuevo presupuesto</DialogTitle></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente registrado</Label>
                <Select value={form.customer_id} onValueChange={(value) => setForm({ ...form, customer_id: value === "__none__" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin seleccionar</SelectItem>
                    {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre cliente</Label>
                <Input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} placeholder="O escribi un nombre" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lineas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-3 w-3" /> Linea</Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input className="flex-1" placeholder="Descripcion" value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} />
                    <Input className="w-20" type="number" step="any" placeholder="Cant." value={line.quantity} onChange={(event) => updateLine(index, "quantity", parseFloat(event.target.value) || 0)} />
                    <Input className="w-28" type="number" step="any" placeholder="Precio" value={line.unit_price} onChange={(event) => updateLine(index, "unit_price", parseFloat(event.target.value) || 0)} />
                    <span className="w-24 pt-2 text-right text-sm text-muted-foreground">
                      ${(line.quantity * line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                    {lines.length > 1 ? (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeLine(index)}><X className="h-3 w-3" /></Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-right font-bold">
                Total: ${lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Crear presupuesto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!quoteToDelete}
        onOpenChange={(open) => {
          if (!open) setQuoteToDelete(null);
        }}
        title="Eliminar presupuesto"
        description={quoteToDelete ? `Esta accion eliminara el presupuesto #${quoteToDelete.quote_number} de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!quoteToDelete) return;
          deleteMutation.mutate(quoteToDelete.id);
          setQuoteToDelete(null);
        }}
      />

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle del presupuesto</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripcion</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">P. Unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quoteLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right font-mono">${Number(line.unit_price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-mono">${Number(line.subtotal).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
