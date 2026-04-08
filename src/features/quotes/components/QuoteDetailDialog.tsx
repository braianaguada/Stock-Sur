import { EntityDialog } from "@/components/common/EntityDialog";
import { LineItemsTable } from "@/components/common/LineItemsTable";
import type { QuoteLineRow } from "@/features/quotes/types";

interface QuoteDetailDialogProps {
  lines: QuoteLineRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailDialog({ lines, open, onOpenChange }: QuoteDetailDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Detalle del presupuesto"
      contentClassName="max-w-2xl"
    >
      <LineItemsTable
        rows={lines.map((line) => ({
          id: line.id,
          description: line.description,
          quantity: line.quantity,
          unit: "un",
          unit_price: line.unit_price,
          total: line.subtotal,
        }))}
        showOrder={false}
      />
    </EntityDialog>
  );
}
