import { AlertTriangle, Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExtractionReviewLine, NormalizeDiagnostics } from "@/features/suppliers/types";

export function SupplierExtractionReviewDialog({ open, onOpenChange, fileName, lines, diagnostics, isImporting, onLineChange, onRemoveLine, onConfirm, onCancel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string | null;
  lines: ExtractionReviewLine[];
  diagnostics?: NormalizeDiagnostics | null;
  isImporting: boolean;
  onLineChange: (lineId: string, patch: Partial<ExtractionReviewLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const arsCount = lines.filter((line) => line.currency === "ARS").length;
  const usdCount = lines.filter((line) => line.currency === "USD").length;
  const warningCount = lines.filter((line) => ["AMBIGUOUS", "UNSUPPORTED"].includes(line.currency_detection?.status ?? "")).length;
  const presentationCount = lines.filter((line) => line.presentation_raw).length;

  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} title="Revisar importación" description={fileName ? `Verificá los productos detectados en ${fileName}.` : "Verificá el listado antes de importarlo."} contentClassName="max-h-[calc(100dvh-1rem)] max-w-5xl overflow-y-auto" footer={<><Button variant="outline" onClick={onCancel} disabled={isImporting}>Cancelar</Button><Button onClick={onConfirm} disabled={isImporting || lines.length === 0 || warningCount > 0}>{isImporting ? "Importando…" : "Confirmar importación"}</Button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{lines.length} productos</span><span>{arsCount} ARS</span><span>{usdCount} USD</span>
          {arsCount > 0 && usdCount > 0 && <span className="font-medium text-foreground">Lista mixta</span>}
          <span>{presentationCount} presentaciones detectadas</span>
        </div>
        {diagnostics && (
          <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <span><strong>{diagnostics.keptRows}</strong> filas interpretadas</span>
            <span><strong>{diagnostics.dropped_missingDesc}</strong> sin producto</span>
            <span><strong>{diagnostics.dropped_invalidPrice}</strong> sin precio válido</span>
            <span><strong>{diagnostics.dropped_priceLE0}</strong> con precio cero</span>
          </div>
        )}
        {warningCount > 0 && <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Revisá la moneda de {warningCount} {warningCount === 1 ? "fila marcada" : "filas marcadas"} para continuar.</span></div>}
        <div className="max-h-[62vh] divide-y overflow-y-auto rounded-xl border">
          {lines.map((line, index) => {
            const needsReview = ["AMBIGUOUS", "UNSUPPORTED"].includes(line.currency_detection?.status ?? "");
            return (
              <article key={line.id} className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_auto] lg:items-end">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`description-${line.id}`}>Producto {index + 1}</Label>
                  <Input id={`description-${line.id}`} value={line.product_name ?? line.raw_description} onChange={(event) => onLineChange(line.id, { product_name: event.target.value })} placeholder="Nombre del producto" />
                  {line.additional_description && <p className="line-clamp-2 text-xs text-muted-foreground" title={line.additional_description}>{line.additional_description}</p>}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1"><Label htmlFor={`code-${line.id}`} className="text-xs">Código (opcional)</Label><Input id={`code-${line.id}`} value={line.supplier_code ?? ""} onChange={(event) => onLineChange(line.id, { supplier_code: event.target.value.trim() || null })} placeholder="Sin código" /></div>
                    <div className="space-y-1"><Label htmlFor={`price-${line.id}`} className="text-xs">Precio</Label><Input id={`price-${line.id}`} className="text-right tabular-nums" type="number" min="0" step="0.01" value={Number.isFinite(line.cost) ? line.cost : 0} onChange={(event) => onLineChange(line.id, { cost: Number(event.target.value) || 0 })} /></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`presentation-${line.id}`}>Presentación</Label>
                  <Input id={`presentation-${line.id}`} value={line.presentation_raw ?? ""} onChange={(event) => onLineChange(line.id, { presentation_raw: event.target.value.trim() || null })} placeholder="Ej. caja x 12 · 750 ml" />
                  {line.reference_unit_price != null && <p className="text-xs tabular-nums text-muted-foreground">Referencia {line.reference_price_basis ?? "por unidad"}: {line.currency} {line.reference_unit_price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>}
                  <p className="text-xs text-muted-foreground">{line.semantic_detection?.source === "NOT_DETECTED" ? "No detectada; podés completarla" : `Detectada · ${Math.round((line.semantic_detection?.confidence ?? 0) * 100)}%`}</p>
                  {(line.semantic_detection?.warnings.length ?? 0) > 0 && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{line.semantic_detection?.warnings.join(". ")}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Moneda</Label>
                  <Select value={line.currency} onValueChange={(value: "ARS" | "USD") => onLineChange(line.id, { currency: value, currency_detection: { currency: value, source: "MANUAL", status: "DETECTED", rawEvidence: value } })}><SelectTrigger aria-label={`Moneda del producto ${index + 1}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">ARS</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select>
                  <p className={`text-xs ${needsReview ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{needsReview ? "Requiere confirmación" : line.currency_detection?.status === "DEFAULTED" ? "ARS por defecto" : "Moneda detectada"}</p>
                  {needsReview && <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onLineChange(line.id, { currency_detection: { currency: line.currency, source: "MANUAL", status: "DETECTED", rawEvidence: line.currency } })}>Confirmar {line.currency}</Button>}
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${line.raw_description}`} onClick={() => onRemoveLine(line.id)}><Trash2 className="h-4 w-4" /></Button>
                {(line.source_page || typeof line.confidence === "number") && <p className="text-xs text-muted-foreground sm:col-span-3">Origen: {line.source_page ? `página ${line.source_page}` : "archivo"}{typeof line.confidence === "number" ? ` · confianza ${Math.round(line.confidence * 100)}%` : ""}</p>}
              </article>
            );
          })}
        </div>
      </div>
    </EntityDialog>
  );
}
