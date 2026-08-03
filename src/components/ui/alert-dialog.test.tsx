import { render, screen } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

describe("AlertDialogContent", () => {
  it("uses an opaque semantic surface with stable contrast", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Confirmar acción</AlertDialogTitle>
          <AlertDialogDescription>Esta operación requiere confirmación.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole("alertdialog")).toHaveClass(
      "z-50",
      "border-border",
      "bg-background",
      "text-foreground",
      "shadow-[var(--shadow-md)]",
    );
  });
});
