import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { QuoteLineRow } from "@/features/quotes/types";

interface QuoteDetailDialogProps {
  lines: QuoteLineRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailDialog({ lines, open, onOpenChange }: QuoteDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {lines.map((line) => (
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
  );
}
