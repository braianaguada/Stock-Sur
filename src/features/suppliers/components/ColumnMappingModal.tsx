import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface MappingColumnOption {
  key: string;
  label: string;
}

export interface MappingPreviewRow {
  id: string;
  values: string[];
}

export interface MappingSelection {
  descriptionColumn: string;
  priceColumn: string;
  currencyColumn: string | null;
  supplierCodeColumn: string | null;
  remember: boolean;
}

interface ColumnMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: MappingColumnOption[];
  previewRows: MappingPreviewRow[];
  suggestedMapping: Omit<MappingSelection, "remember">;
  confidence: number;
  onConfirm: (mapping: MappingSelection) => void;
  onCancel: () => void;
}

const NONE = "__none__";

export function ColumnMappingModal({
  open,
  onOpenChange,
  columns,
  previewRows,
  suggestedMapping,
  confidence,
  onConfirm,
  onCancel,
}: ColumnMappingModalProps) {
  const [descriptionColumn, setDescriptionColumn] = useState(suggestedMapping.descriptionColumn);
  const [priceColumn, setPriceColumn] = useState(suggestedMapping.priceColumn);
  const [currencyColumn, setCurrencyColumn] = useState(suggestedMapping.currencyColumn ?? NONE);
  const [supplierCodeColumn, setSupplierCodeColumn] = useState(suggestedMapping.supplierCodeColumn ?? NONE);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDescriptionColumn(suggestedMapping.descriptionColumn);
    setPriceColumn(suggestedMapping.priceColumn);
    setCurrencyColumn(suggestedMapping.currencyColumn ?? NONE);
    setSupplierCodeColumn(suggestedMapping.supplierCodeColumn ?? NONE);
    setRemember(true);
  }, [open, suggestedMapping]);

  const previewHeaders = useMemo(
    () => columns.slice(0, 8),
    [columns],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Mapear columnas del archivo</DialogTitle>
          <DialogDescription>
            No hubo confianza suficiente en la detección automática ({Math.round(confidence * 100)}%).
            Elegí manualmente las columnas para importar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Columna de descripción/producto *</Label>
            <Select value={descriptionColumn} onValueChange={setDescriptionColumn}>
              <SelectTrigger><SelectValue placeholder="Seleccionar columna" /></SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Columna de precio/costo *</Label>
            <Select value={priceColumn} onValueChange={setPriceColumn}>
              <SelectTrigger><SelectValue placeholder="Seleccionar columna" /></SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Columna de moneda (opcional)</Label>
            <Select value={currencyColumn} onValueChange={setCurrencyColumn}>
              <SelectTrigger><SelectValue placeholder="Sin columna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin columna</SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Columna de código (opcional)</Label>
            <Select value={supplierCodeColumn} onValueChange={setSupplierCodeColumn}>
              <SelectTrigger><SelectValue placeholder="Sin columna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin columna</SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded border">
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr>
                  {previewHeaders.map((header) => (
                    <th key={header.key} className="border-b px-2 py-1 text-left font-medium">{header.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    {previewHeaders.map((header, index) => (
                      <td key={`${row.id}-${header.key}`} className="border-b px-2 py-1 align-top text-xs">
                        {row.values[index] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} id="remember-mapping" />
          <Label htmlFor="remember-mapping">Recordar para este proveedor</Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => onConfirm({
              descriptionColumn,
              priceColumn,
              currencyColumn: currencyColumn === NONE ? null : currencyColumn,
              supplierCodeColumn: supplierCodeColumn === NONE ? null : supplierCodeColumn,
              remember,
            })}
            disabled={!descriptionColumn || !priceColumn}
          >
            Confirmar mapeo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
