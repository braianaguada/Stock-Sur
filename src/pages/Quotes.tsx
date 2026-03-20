import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, FileDown } from "lucide-react";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { QuoteDetailDialog } from "@/features/quotes/components/QuoteDetailDialog";
import { QuoteEditorDialog } from "@/features/quotes/components/QuoteEditorDialog";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/features/quotes/constants";
import { useQuotesFlow } from "@/features/quotes/hooks/useQuotesFlow";

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

      <QuoteEditorDialog
        open={dialogOpen}
        customers={customers}
        form={form}
        lines={lines}
        isSaving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onFormChange={setForm}
        onAddLine={addLine}
        onLineChange={updateLine}
        onRemoveLine={removeLine}
        onSubmit={() => saveMutation.mutate()}
      />

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

      <QuoteDetailDialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen} lines={quoteLines} />
    </AppLayout>
  );
}
