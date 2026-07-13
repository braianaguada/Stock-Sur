import { useEffect, useMemo, useState } from "react";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SupplierMappingPreviewTable } from "@/features/suppliers/components/SupplierMappingPreviewTable";

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
  presentationColumn: string | null;
  contentValueColumn: string | null;
  referencePriceColumn: string | null;
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
  const [presentationColumn, setPresentationColumn] = useState(suggestedMapping.presentationColumn ?? NONE);
  const [contentValueColumn, setContentValueColumn] = useState(suggestedMapping.contentValueColumn ?? NONE);
  const [referencePriceColumn, setReferencePriceColumn] = useState(suggestedMapping.referencePriceColumn ?? NONE);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDescriptionColumn(suggestedMapping.descriptionColumn);
    setPriceColumn(suggestedMapping.priceColumn);
    setCurrencyColumn(suggestedMapping.currencyColumn ?? NONE);
    setSupplierCodeColumn(suggestedMapping.supplierCodeColumn ?? NONE);
    setPresentationColumn(suggestedMapping.presentationColumn ?? NONE);
    setContentValueColumn(suggestedMapping.contentValueColumn ?? NONE);
    setReferencePriceColumn(suggestedMapping.referencePriceColumn ?? NONE);
    setRemember(true);
  }, [open, suggestedMapping]);

  const previewHeaders = useMemo(() => columns.slice(0, 8).map((column) => {
    const roles = [
      column.key === descriptionColumn ? "Producto" : null,
      column.key === priceColumn ? "Precio principal" : null,
      column.key === currencyColumn ? "Moneda" : null,
      column.key === supplierCodeColumn ? "Código" : null,
      column.key === presentationColumn ? "Presentación" : null,
      column.key === contentValueColumn ? "Contenido" : null,
      column.key === referencePriceColumn ? "Precio referencia" : null,
    ].filter(Boolean);
    return { ...column, label: roles.length > 0 ? `${column.label} · ${roles.join(" / ")}` : `${column.label} · Omitida` };
  }), [columns, contentValueColumn, currencyColumn, descriptionColumn, presentationColumn, priceColumn, referencePriceColumn, supplierCodeColumn]);
  const previewMatrix = useMemo(
    () => previewRows.slice(0, 20).map((row) => row.values),
    [previewRows],
  );

  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mapear columnas del archivo"
      description={`Revisá qué información se detectó antes de importar. Confianza automática: ${Math.round(confidence * 100)}%.`}
      contentClassName="max-w-5xl overflow-x-hidden"
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={() => onConfirm({
              descriptionColumn,
              priceColumn,
              currencyColumn: currencyColumn === NONE ? null : currencyColumn,
              supplierCodeColumn: supplierCodeColumn === NONE ? null : supplierCodeColumn,
              presentationColumn: presentationColumn === NONE ? null : presentationColumn,
              contentValueColumn: contentValueColumn === NONE ? null : contentValueColumn,
              referencePriceColumn: referencePriceColumn === NONE ? null : referencePriceColumn,
              remember,
            })}
            disabled={!descriptionColumn || !priceColumn}
          >
            Confirmar mapeo
          </Button>
        </>
      )}
    >
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
        {([
          ["Envase o presentación (opcional)", presentationColumn, setPresentationColumn],
          ["Contenido, peso o volumen (opcional)", contentValueColumn, setContentValueColumn],
          ["Precio de referencia (opcional)", referencePriceColumn, setReferencePriceColumn],
        ] as const).map(([label, value, setter]) => (
          <div className="space-y-2" key={label}>
            <Label>{label}</Label>
            <Select value={value} onValueChange={setter}>
              <SelectTrigger><SelectValue placeholder="Sin columna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin columna</SelectItem>
                {columns.map((column) => (
                  <SelectItem key={column.key} value={column.key}>{column.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="rounded border max-h-72 overflow-auto">
        <SupplierMappingPreviewTable
          headers={previewHeaders.map((header) => header.label)}
          rows={previewMatrix}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={remember}
          onCheckedChange={(checked) => setRemember(checked === true)}
          id="remember-mapping"
        />
        <Label htmlFor="remember-mapping">Recordar para este proveedor</Label>
      </div>
    </EntityDialog>
  );
}
