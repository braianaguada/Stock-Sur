import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClearableSearchInputProps = Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function ClearableSearchInput({ value, onValueChange, className, ...props }: ClearableSearchInputProps) {
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input type="search" value={value} onChange={(event) => onValueChange(event.target.value)} className={cn("pl-9", value && "pr-10", className)} {...props} />
      {value ? <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => onValueChange("")} aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></Button> : null}
    </div>
  );
}
