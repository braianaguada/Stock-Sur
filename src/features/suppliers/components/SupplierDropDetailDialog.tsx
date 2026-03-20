import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Filas descartadas</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Muestra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnostics?.sampleDropped?.length ? (
                diagnostics.sampleDropped.map((row) => (
                  <TableRow key={`${row.rowIndex}-${row.reason}`}>
                    <TableCell>{row.rowIndex}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell className="font-mono text-xs">{row.rowPreview.join(" | ")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="py-4 text-center text-muted-foreground">
                    Sin muestra disponible
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
