import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
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
      <DialogContent className={cn("w-[min(92vw,46rem)] max-w-[46rem] max-h-[88vh] overflow-y-auto", contentClassName)}>
        <DialogHeader className={headerClassName}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
