import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface PdfMappingSelection {
  descriptionColumn: string;
  priceColumn: string;
  codeColumn: string | null;
  preferPriceAtEnd: boolean;
  filterRowsWithoutPrice: boolean;
  remember: boolean;
}

interface PdfMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  rows: string[][];
  suggested: Omit<PdfMappingSelection, "remember">;
  onApply: (selection: PdfMappingSelection) => void;
  onCancel: () => void;
}

const NONE = "__none__";

export function PdfMappingModal({
  open,
  onOpenChange,
  headers,
  rows,
  suggested,
  onApply,
  onCancel,
}: PdfMappingModalProps) {
  const [descriptionColumn, setDescriptionColumn] = useState(suggested.descriptionColumn);
  const [priceColumn, setPriceColumn] = useState(suggested.priceColumn);
  const [codeColumn, setCodeColumn] = useState(suggested.codeColumn ?? NONE);
  const [preferPriceAtEnd, setPreferPriceAtEnd] = useState(suggested.preferPriceAtEnd);
  const [filterRowsWithoutPrice, setFilterRowsWithoutPrice] = useState(suggested.filterRowsWithoutPrice);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDescriptionColumn(suggested.descriptionColumn);
    setPriceColumn(suggested.priceColumn);
    setCodeColumn(suggested.codeColumn ?? NONE);
    setPreferPriceAtEnd(suggested.preferPriceAtEnd);
    setFilterRowsWithoutPrice(suggested.filterRowsWithoutPrice);
    setRemember(true);
  }, [open, suggested]);

  const limitedHeaders = useMemo(() => headers.slice(0, 10), [headers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Mapeo PDF</DialogTitle>
          <DialogDescription>
            Revisa la tabla detectada y elegi columnas para descripcion, precio y codigo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Select value={descriptionColumn} onValueChange={setDescriptionColumn}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Precio *</Label>
            <Select value={priceColumn} onValueChange={setPriceColumn}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código (opcional)</Label>
            <Select value={codeColumn} onValueChange={setCodeColumn}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin columna</SelectItem>
                {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={preferPriceAtEnd} onCheckedChange={(checked) => setPreferPriceAtEnd(checked === true)} id="pdf-price-end" />
            <Label htmlFor="pdf-price-end">Precio al final</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={filterRowsWithoutPrice} onCheckedChange={(checked) => setFilterRowsWithoutPrice(checked === true)} id="pdf-filter-price" />
            <Label htmlFor="pdf-filter-price">Filtrar filas sin precio</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} id="pdf-remember" />
            <Label htmlFor="pdf-remember">Recordar para este proveedor (PDF)</Label>
          </div>
        </div>

        <div className="max-h-80 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr>
                {limitedHeaders.map((header) => (
                  <th key={header} className="border-b px-2 py-1 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((row, idx) => (
                <tr key={idx}>
                  {limitedHeaders.map((header, colIdx) => (
                    <td key={`${idx}-${header}`} className="border-b px-2 py-1 text-xs">
                      {row[colIdx] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => onApply({
              descriptionColumn,
              priceColumn,
              codeColumn: codeColumn === NONE ? null : codeColumn,
              preferPriceAtEnd,
              filterRowsWithoutPrice,
              remember,
            })}
            disabled={!descriptionColumn || !priceColumn}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
