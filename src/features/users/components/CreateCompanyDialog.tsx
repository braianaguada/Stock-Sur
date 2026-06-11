import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toCompanySlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateCompanyDialog(props: {
  open: boolean;
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: { name: string; slug: string }) => void;
}) {
  const { open, isCreating, onOpenChange, onCreate } = props;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugWasEdited(false);
    }
  }, [open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onCreate({ name: name.trim(), slug: slug.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
            <DialogDescription>
              Se creará vacía y aislada. Luego podrás asignarle usuarios desde este panel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="company-name">Nombre</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!slugWasEdited) setSlug(toCompanySlug(nextName));
              }}
              placeholder="Ej: Sucursal Norte"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-slug">Identificador</Label>
            <Input
              id="company-slug"
              value={slug}
              onChange={(event) => {
                setSlugWasEdited(true);
                setSlug(toCompanySlug(event.target.value));
              }}
              placeholder="sucursal-norte"
            />
            <p className="text-xs text-muted-foreground">
              Debe ser único. Solo admite letras minúsculas, números y guiones.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isCreating} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim() || !slug.trim()}>
              {isCreating ? "Creando..." : "Crear empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
