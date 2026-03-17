import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { canManageSettings } from "@/lib/permissions";

export default function SettingsPage() {
  const { settings, isLoading } = useCompanyBrand();
  const { roles } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [form, setForm] = useState({
    app_name: "",
    legal_name: "",
    tax_id: "",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    primary_color: "#1f4f99",
    secondary_color: "#c62828",
    accent_color: "#eef3fb",
    document_tagline: "",
    document_footer: "",
    default_point_of_sale: "1",
  });

  useEffect(() => {
    setForm({
      app_name: settings.app_name ?? "",
      legal_name: settings.legal_name ?? "",
      tax_id: settings.tax_id ?? "",
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      whatsapp: settings.whatsapp ?? "",
      email: settings.email ?? "",
      primary_color: settings.primary_color ?? "#1f4f99",
      secondary_color: settings.secondary_color ?? "#c62828",
      accent_color: settings.accent_color ?? "#eef3fb",
      document_tagline: settings.document_tagline ?? "",
      document_footer: settings.document_footer ?? "",
      default_point_of_sale: String(settings.default_point_of_sale ?? 1),
    });
    setLogoPreview(settings.logo_url ?? "");
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = settings.logo_url;

      if (logoFile) {
        const extension = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
        const filePath = `company-logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("branding-assets")
          .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type || undefined });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("branding-assets").getPublicUrl(filePath);
        logoUrl = data.publicUrl;
      }

      const payload = {
        id: 1,
        app_name: form.app_name.trim() || "Stock Sur",
        legal_name: form.legal_name.trim() || null,
        tax_id: form.tax_id.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        logo_url: logoUrl ?? null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        document_tagline: form.document_tagline.trim() || null,
        document_footer: form.document_footer.trim() || null,
        default_point_of_sale: Math.max(1, Number(form.default_point_of_sale) || 1),
      };

      const { error } = await supabase.from("company_settings").upsert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      setLogoFile(null);
      await qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Configuracion guardada" });
    },
    onError: (error: unknown) => {
      toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
  };

  if (!canManageSettings(roles)) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
            <p className="text-muted-foreground">Acceso restringido a usuarios administradores.</p>
          </div>

          <Card className="max-w-2xl rounded-3xl border-amber-200 bg-amber-50/80">
            <CardHeader>
              <CardTitle>Sin permisos</CardTitle>
              <CardDescription>La configuracion global de empresa y branding solo puede modificarla un administrador.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border bg-gradient-to-r from-[hsl(var(--accent))] via-card to-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Empresa, identidad visual y encabezados de documentos. Todo lo que definas aca se refleja en menus, PDFs y branding compartido.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-full border bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {form.app_name || "Nombre de la app"}
            </div>
            <div className="flex items-center gap-2 rounded-full border bg-background/70 px-4 py-2 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: form.primary_color }} />
              Primario
              <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: form.secondary_color }} />
              Secundario
              <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: form.accent_color }} />
              Acento
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Estos datos se reutilizan en la app, el sidebar y los PDFs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre visible de la app</Label>
                  <Input value={form.app_name} onChange={(e) => setForm((prev) => ({ ...prev, app_name: e.target.value }))} placeholder="Alpataco Refrigeracion" />
                </div>
                <div className="space-y-2">
                  <Label>Razon social</Label>
                  <Input value={form.legal_name} onChange={(e) => setForm((prev) => ({ ...prev, legal_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CUIT</Label>
                  <Input value={form.tax_id} onChange={(e) => setForm((prev) => ({ ...prev, tax_id: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Punto de venta por defecto</Label>
                  <Input type="number" min={1} value={form.default_point_of_sale} onChange={(e) => setForm((prev) => ({ ...prev, default_point_of_sale: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Direccion</Label>
                  <Input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Telefono</Label>
                  <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tagline del documento</Label>
                  <Input value={form.document_tagline} onChange={(e) => setForm((prev) => ({ ...prev, document_tagline: e.target.value }))} placeholder="Documentacion comercial" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Pie de documento</Label>
                  <Textarea value={form.document_footer} onChange={(e) => setForm((prev) => ({ ...prev, document_footer: e.target.value }))} rows={3} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Marca visual</CardTitle>
                <CardDescription>SVG es el formato ideal para logo. PNG funciona como respaldo. El color de acento se usa para fondos suaves, paneles seleccionados y superficies de apoyo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <Input type="file" accept=".svg,image/*" onChange={onLogoChange} />
                </div>
                <div className="rounded-xl border bg-muted/30 p-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview del logo" className="h-20 w-full object-contain" />
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      Sin logo cargado
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Color primario</Label>
                    <Input type="color" value={form.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))} className="h-12 p-2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color secundario</Label>
                    <Input type="color" value={form.secondary_color} onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))} className="h-12 p-2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color de acento</Label>
                    <Input type="color" value={form.accent_color} onChange={(e) => setForm((prev) => ({ ...prev, accent_color: e.target.value }))} className="h-12 p-2" />
                  </div>
                </div>
                <div className="rounded-3xl border p-4">
                  <p className="mb-3 text-sm font-medium">Vista previa</p>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border p-4" style={{ backgroundColor: form.accent_color }}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <div className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: form.primary_color }}>
                          Primario
                        </div>
                        <div className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: form.secondary_color }}>
                          Secundario
                        </div>
                        <div className="rounded-lg border bg-white/70 px-4 py-2 text-sm font-semibold" style={{ borderColor: form.primary_color }}>
                          Acento
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-white/80 p-4">
                        <p className="text-sm font-semibold" style={{ color: form.primary_color }}>Panel con acento</p>
                        <p className="mt-1 text-sm text-slate-600">Este fondo usa el color de acento como superficie suave para hover, seleccion y paneles destacados.</p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-3xl border">
                      <div className="flex min-h-[160px]">
                        <div className="w-28 p-4 text-white" style={{ backgroundColor: form.primary_color }}>
                          <div className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold">Sidebar</div>
                          <div className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold" style={{ backgroundColor: form.secondary_color }}>
                            Item activo
                          </div>
                        </div>
                        <div className="flex-1 p-4" style={{ backgroundColor: form.accent_color }}>
                          <div className="rounded-2xl border bg-white p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Preview de interfaz</p>
                            <p className="mt-2 text-lg font-bold" style={{ color: form.primary_color }}>{form.app_name || "Tu empresa"}</p>
                            <p className="mt-1 text-sm text-slate-600">Asi se perciben juntos los tres colores dentro de la app.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading} className="w-full">
                  {saveMutation.isPending ? "Guardando..." : "Guardar configuracion"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
