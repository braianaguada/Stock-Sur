import { useEffect, useState } from "react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupplierMappingPreviewTable } from "@/features/suppliers/components/SupplierMappingPreviewTable";

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

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mapeo PDF"
      description="Revisa la tabla detectada y elige columnas para descripción, precio y código."
      contentClassName="max-w-6xl overflow-x-hidden"
      footer={(
        <>
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
        </>
      )}
    >
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
          <Checkbox
            checked={preferPriceAtEnd}
            onCheckedChange={(checked) => setPreferPriceAtEnd(checked === true)}
            id="pdf-price-end"
          />
          <Label htmlFor="pdf-price-end">Precio al final</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={filterRowsWithoutPrice}
            onCheckedChange={(checked) => setFilterRowsWithoutPrice(checked === true)}
            id="pdf-filter-price"
          />
          <Label htmlFor="pdf-filter-price">Filtrar filas sin precio</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} id="pdf-remember" />
          <Label htmlFor="pdf-remember">Recordar para este proveedor (PDF)</Label>
        </div>
      </div>

      <div className="max-h-80 overflow-auto rounded border">
        <SupplierMappingPreviewTable headers={headers} rows={rows} maxColumns={10} maxRows={30} />
      </div>
    </EntityDialog>
  );
}
