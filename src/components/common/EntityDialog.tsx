import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type EntityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
};

export function EntityDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  headerClassName,
  bodyClassName,
}: EntityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="form"
        className={cn("flex max-h-[min(88dvh,900px)] flex-col overflow-hidden", contentClassName)}
      >
        <DialogHeader className={cn("shrink-0 pr-8", headerClassName)}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? `Información y acciones de ${title}.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={cn("-mx-1 px-1", bodyClassName)}>{children}</DialogBody>
        {footer ? <DialogFooter className="shrink-0 border-t pt-4">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
