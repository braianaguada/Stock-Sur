import { useEffect, useId, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/common/VisualSystem";
import type { SupplierCartItem } from "../pricing";

export function SupplierCartTrigger({ items, onOpen }: { items: SupplierCartItem[]; onOpen: () => void }) {
  const [preview, setPreview] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!preview) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) setPreview(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [preview]);
  return <div ref={ref} className="relative" onMouseEnter={() => setPreview(true)} onMouseLeave={() => { if (!ref.current?.contains(document.activeElement)) setPreview(false); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPreview(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setPreview(false); buttonRef.current?.focus(); } }}>
    <Button ref={buttonRef} variant="outline" size="icon" className="relative rounded-full" aria-label={`Carrito de compras: ${items.length} productos`} aria-expanded={preview} aria-controls={preview ? id : undefined} onClick={() => setPreview((open) => !open)}>
      <ShoppingCart className="h-4 w-4" />{items.length > 0 && <span className="absolute -right-2 -top-2"><CountBadge>{items.length}</CountBadge></span>}
    </Button>
    {preview && <section id={id} aria-label="Resumen del carrito" className="absolute right-0 top-full z-50 w-[min(22rem,calc(100vw-2rem))] pt-2"><div className="rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg">
      <h2 className="font-semibold">Carrito de compras</h2>
      <p className="mb-3 text-xs text-muted-foreground">{items.length} productos · {new Set(items.map((item) => item.supplierId)).size} proveedores</p>
      {items.length ? <ul className="space-y-2">{items.slice(-5).reverse().map((item) => <li key={item.line.id} className="flex gap-3 text-sm"><span className="font-medium tabular-nums">{item.quantity}×</span><span className="min-w-0"><span className="block truncate">{item.line.raw_description}</span><span className="block truncate text-xs text-muted-foreground">{item.listName}</span></span></li>)}</ul> : <p className="text-sm text-muted-foreground">Agregá productos desde las listas o la comparación.</p>}
      <Button className="mt-4 w-full" onClick={() => { setPreview(false); onOpen(); }}>Ver carrito</Button>
    </div></section>}
  </div>;
}
