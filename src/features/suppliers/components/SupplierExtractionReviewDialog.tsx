import { Trash2 } from "lucide-react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExtractionReviewLine } from "@/features/suppliers/types";

interface SupplierExtractionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string | null;
  lines: ExtractionReviewLine[];
  isImporting: boolean;
  onLineChange: (lineId: string, patch: Partial<ExtractionReviewLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SupplierExtractionReviewDialog({
  open,
  onOpenChange,
  fileName,
  lines,
  isImporting,
  onLineChange,
  onRemoveLine,
  onConfirm,
  onCancel,
}: SupplierExtractionReviewDialogProps) {
  const arsCount = lines.filter((line) => line.currency === "ARS").length;
  const usdCount = lines.filter((line) => line.currency === "USD").length;

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revisar listado extraido"
      description={fileName ? `Revisa el listado detectado en ${fileName} antes de importarlo.` : "Revisa el listado antes de importarlo."}
      contentClassName="max-w-7xl"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel} disabled={isImporting}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isImporting || lines.length === 0}>
            {isImporting ? "Importando..." : "Confirmar e importar"}
          </Button>
        </>
      )}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Lineas detectadas: {lines.length}</span>
          <span>ARS: {arsCount}</span>
          <span>USD: {usdCount}</span>
        </div>

        <div className="max-h-[65vh] overflow-auto rounded-xl border">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="sticky top-0 bg-background shadow-sm">
              <tr className="border-b">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Codigo</th>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Precio</th>
                <th className="px-3 py-2 text-left">Moneda</th>
                <th className="px-3 py-2 text-left">Pagina</th>
                <th className="px-3 py-2 text-left">Conf.</th>
                <th className="px-3 py-2 text-right">Accion</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} className="border-b align-top">
                  <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.supplier_code ?? ""}
                      onChange={(event) => onLineChange(line.id, { supplier_code: event.target.value.trim() || null })}
                      placeholder="S/COD"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="grid gap-1">
                      <Label className="sr-only">Producto</Label>
                      <Input
                        value={line.raw_description}
                        onChange={(event) => onLineChange(line.id, { raw_description: event.target.value })}
                        placeholder="Nombre del producto"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number.isFinite(line.cost) ? line.cost : 0}
                      onChange={(event) => onLineChange(line.id, { cost: Number(event.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select value={line.currency} onValueChange={(value) => onLineChange(line.id, { currency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">ARS</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{line.source_page ?? "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {typeof line.confidence === "number" ? `${Math.round(line.confidence * 100)}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => onRemoveLine(line.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </EntityDialog>
  );
}
