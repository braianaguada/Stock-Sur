import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type DocumentConfirmationTone = "info" | "warning" | "danger";

interface DocumentConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: DocumentConfirmationTone;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const toneStyles = {
  info: {
    icon: Info,
    iconClassName: "border-info/30 bg-info/10 text-info",
    actionClassName: "bg-sky-700 text-white hover:bg-sky-800",
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: "border-warning/35 bg-warning/10 text-warning",
    actionClassName: "bg-amber-600 text-white hover:bg-amber-700",
  },
  danger: {
    icon: CircleAlert,
    iconClassName: "border-destructive/30 bg-destructive/10 text-destructive",
    actionClassName: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
} satisfies Record<
  DocumentConfirmationTone,
  { icon: typeof Info; iconClassName: string; actionClassName: string }
>;

export function DocumentConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "warning",
  isPending = false,
  onOpenChange,
  onConfirm,
}: DocumentConfirmationDialogProps) {
  const style = toneStyles[tone];
  const Icon = style.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden border-border bg-card p-0 text-card-foreground shadow-2xl">
        <div className="flex gap-4 p-6">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
              style.iconClassName,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogHeader className="min-w-0 flex-1 pt-0.5 text-left">
            <AlertDialogTitle className="text-lg text-foreground">{title}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-muted-foreground">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="border-t border-border bg-muted/35 px-6 py-4">
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className={style.actionClassName}
            onClick={onConfirm}
          >
            {isPending ? "Procesando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
