import { EntityDialog } from "@/components/common/EntityDialog";
import { SupplierDroppedRowsTable } from "@/features/suppliers/components/SupplierDroppedRowsTable";
import type { NormalizeDiagnostics } from "@/features/suppliers/types";

interface SupplierDropDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnostics: NormalizeDiagnostics | null;
}

export function SupplierDropDetailDialog({
  open,
  onOpenChange,
  diagnostics,
}: SupplierDropDetailDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filas descartadas"
      contentClassName="max-w-3xl"
    >
      <div className="max-h-[60vh] overflow-auto rounded border">
        <SupplierDroppedRowsTable rows={diagnostics?.sampleDropped ?? []} />
      </div>
    </EntityDialog>
  );
}
