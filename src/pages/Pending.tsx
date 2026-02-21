import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Link2, Plus } from "lucide-react";

export default function PendingPage() {
  const [search, setSearch] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pendingLines = [], isLoading } = useQuery({
    queryKey: ["pending-lines", search],
    queryFn: async () => {
      let q = supabase
        .from("price_list_lines")
        .select("*, price_list_versions(version_date, price_lists(name, suppliers(name)))")
        .eq("match_status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) q = q.ilike("raw_description", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items-search", itemSearch],
    enabled: assignDialogOpen,
    queryFn: async () => {
      let q = supabase.from("items").select("id, name, sku").eq("is_active", true).order("name").limit(50);
      if (itemSearch) q = q.or(`name.ilike.%${itemSearch}%,sku.ilike.%${itemSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItemId || !selectedLine) throw new Error("Seleccioná un ítem");
      const { error } = await supabase
        .from("price_list_lines")
        .update({ item_id: selectedItemId, match_status: "MATCHED" as const })
        .eq("id", selectedLine.id);
      if (error) throw error;

      // Also create alias for future matching
      await supabase.from("item_aliases").insert({
        item_id: selectedItemId,
        alias: selectedLine.raw_description,
        is_supplier_code: false,
      }).then(() => {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-lines"] });
      setAssignDialogOpen(false);
      toast({ title: "Ítem asignado y alias creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAssign = (line: any) => {
    setSelectedLine(line);
    setSelectedItemId("");
    setItemSearch("");
    setAssignDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pendientes</h1>
          <p className="text-muted-foreground">Líneas de listas de precios sin asignar a un ítem</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar descripción..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cód. Prov.</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Lista / Proveedor</TableHead>
                <TableHead className="w-[80px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : pendingLines.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay líneas pendientes 🎉</TableCell></TableRow>
              ) : pendingLines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm max-w-xs truncate">{l.raw_description}</TableCell>
                  <TableCell className="font-mono text-xs">{l.supplier_code ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(l.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.price_list_versions?.price_lists?.name ?? "—"} / {l.price_list_versions?.price_lists?.suppliers?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openAssign(l)}>
                      <Link2 className="h-3 w-3 mr-1" /> Asignar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar ítem</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm font-medium">{selectedLine?.raw_description}</p>
              <p className="text-xs text-muted-foreground mt-1">Precio: ${Number(selectedLine?.price ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-2">
              <Input placeholder="Buscar ítem..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
              <div className="max-h-48 overflow-auto border rounded-md">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedItemId === item.id ? "bg-accent font-medium" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">{item.sku}</span>
                    {item.name}
                  </button>
                ))}
                {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>}
              </div>
            </div>
            <Button onClick={() => assignMutation.mutate()} disabled={!selectedItemId || assignMutation.isPending} className="w-full">
              {assignMutation.isPending ? "Asignando..." : "Asignar y crear alias"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
