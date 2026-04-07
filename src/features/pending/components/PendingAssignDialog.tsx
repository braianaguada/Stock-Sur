import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PendingItemOption, PendingLine } from "@/features/pending/types";

type PendingAssignDialogProps = {
  open: boolean;
  line: PendingLine | null;
  itemSearch: string;
  items: PendingItemOption[];
  selectedItemId: string;
  onOpenChange: (open: boolean) => void;
  onItemSearchChange: (value: string) => void;
  onSelectedItemChange: (itemId: string) => void;
  onContinue: () => void;
};

export function PendingAssignDialog({
  open,
  line,
  itemSearch,
  items,
  selectedItemId,
  onOpenChange,
  onItemSearchChange,
  onSelectedItemChange,
  onContinue,
}: PendingAssignDialogProps) {
  return (
    <EntityDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Asignar item"
      contentClassName="sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-sm font-medium">{line?.raw_description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Precio: $
            {Number(line?.price ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Buscar item..."
            value={itemSearch}
            onChange={(event) => onItemSearchChange(event.target.value)}
          />
          <div className="max-h-48 overflow-auto rounded-2xl border">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectedItemChange(item.id)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                  selectedItemId === item.id ? "bg-accent font-medium" : ""
                }`}
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">{item.sku}</span>
                {item.name}
              </button>
            ))}
            {items.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
            ) : null}
          </div>
        </div>
        <Button onClick={onContinue} disabled={!selectedItemId} className="w-full">
          Continuar a crear alias
        </Button>
      </div>
    </EntityDialog>
  );
}
