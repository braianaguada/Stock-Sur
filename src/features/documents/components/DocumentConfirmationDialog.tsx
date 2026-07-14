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
    iconClassName: "border-sky-200 bg-sky-50 text-sky-700",
    actionClassName: "bg-sky-700 text-white hover:bg-sky-800",
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: "border-amber-200 bg-amber-50 text-amber-700",
    actionClassName: "bg-amber-600 text-white hover:bg-amber-700",
  },
  danger: {
    icon: CircleAlert,
    iconClassName: "border-rose-200 bg-rose-50 text-rose-700",
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
      <AlertDialogContent className="max-w-md border-slate-200 p-0 shadow-2xl">
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
            <AlertDialogTitle className="text-lg text-slate-950">{title}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-slate-600">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
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
