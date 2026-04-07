import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page";
import { THEME_OPTIONS, buildCompanyThemePayload } from "@/lib/companyTheme";
import { useToast } from "@/hooks/use-toast";
import { useSettingsManagement } from "@/features/settings/hooks/useSettingsManagement";

export default function SettingsPage() {
  const { roles, currentCompany, companyRoleCodes, companyPermissionCodes } = useAuth();
  const { toast } = useToast();
  const {
    canManage,
    form,
    isLoading,
    logoPreview,
    onLogoChange,
    previewTheme,
    saveMutation,
    setForm,
    setThemePreset,
    themePreset,
  } = useSettingsManagement({
    companyId: currentCompany?.id,
    roles,
    companyRoleCodes,
    companyPermissionCodes,
    toast,
  });

  if (!canManage) {
    return (
      <AppLayout>
        <div className="page-shell">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
            <p className="text-muted-foreground">Acceso restringido a usuarios administradores.</p>
          </div>

          <Card className="max-w-2xl rounded-3xl border-amber-200 bg-amber-50/80">
            <CardHeader>
              <CardTitle>Sin permisos</CardTitle>
              <CardDescription>
                La configuracion global de empresa y branding solo puede modificarla un administrador.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!currentCompany) {
    return (
      <AppLayout>
        <div className="page-shell">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
            <p className="text-muted-foreground">Todavia no hay una empresa activa seleccionada.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-shell">
        <PageHeader
          eyebrow="Branding y operacion"
          title="Configuracion"
          subtitle={`Empresa, identidad visual y encabezados de documentos para ${currentCompany.name}. Todo lo que definas aca se refleja en menus, PDFs y branding compartido.`}
        />

        <div className="hidden rounded-3xl border bg-gradient-to-r from-[hsl(var(--accent))] via-card to-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Empresa, identidad visual y encabezados de documentos para {currentCompany.name}. Todo lo que definas aca se refleja en menus, PDFs y branding compartido.
          </p>
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
          <Card>
            <CardHeader>
              <CardTitle>Datos de la empresa</CardTitle>
              <CardDescription>Estos datos se reutilizan en la app, la navegacion y los PDFs.</CardDescription>
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
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:col-span-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="allow_issue_remitos_without_stock"
                      checked={form.allow_issue_remitos_without_stock}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          allow_issue_remitos_without_stock: checked === true,
                        }))
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="allow_issue_remitos_without_stock" className="cursor-pointer">
                        Permitir emitir remitos sin stock suficiente
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Si se activa, los remitos pueden emitirse aunque el stock no alcance. La salida igual se registra y el stock puede quedar negativo.
                      </p>
                    </div>
                  </div>
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
            <Card>
              <CardHeader>
                <CardTitle>Marca visual</CardTitle>
                <CardDescription>
                  SVG es el formato ideal para logo. PNG funciona como respaldo. El color de acento se usa para fondos suaves, paneles seleccionados y superficies de apoyo.
                </CardDescription>
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
                <div className="space-y-3">
                  <Label>Tema visual</Label>
                  <div className="grid gap-3">
                    {THEME_OPTIONS.map((theme) => {
                      const sample = buildCompanyThemePayload(theme.id, theme.defaultPrimary);
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            setThemePreset(theme.id);
                            const next = buildCompanyThemePayload(theme.id, theme.defaultPrimary);
                            setForm((prev) => ({ ...prev, ...next }));
                          }}
                          className={`flex items-start justify-between rounded-2xl border px-4 py-4 text-left transition-all ${
                            themePreset === theme.id
                              ? "border-primary bg-primary/5 shadow-[var(--shadow-xs)]"
                              : "border-border/80 bg-background/70 hover:bg-accent/60"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{theme.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{theme.description}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-full border bg-white" style={{ backgroundColor: sample.primary_color }} />
                            <span className="h-3 w-3 rounded-full border bg-white" style={{ backgroundColor: sample.secondary_color }} />
                            <span className="h-3 w-3 rounded-full border bg-white" style={{ backgroundColor: sample.accent_color }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div className="space-y-2">
                    <Label>Color principal</Label>
                    <Input value={form.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))} placeholder="#1f4f99" />
                    <p className="text-xs text-muted-foreground">
                      El sistema deriva automaticamente superficies, hover, topbar y tonos suaves a partir de este color.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Muestra rapida</Label>
                    <Input type="color" value={form.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))} className="h-12 p-2" />
                  </div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-[hsl(var(--panel))]/42 p-4">
                  <p className="mb-3 text-sm font-medium">Vista previa del sistema</p>
                  <div className="grid gap-4">
                    <div className="rounded-2xl border p-4" style={{ backgroundColor: `hsl(${previewTheme.tokens.panel})` }}>
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <div className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: previewTheme.primaryColor }}>
                          Primario
                        </div>
                        <div className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: `hsl(${previewTheme.tokens["primary-soft"]})`, color: `hsl(${previewTheme.tokens.primary})` }}>
                          Soft
                        </div>
                        <div className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: `hsl(${previewTheme.tokens.border})`, backgroundColor: `hsl(${previewTheme.tokens.card})` }}>
                          Superficie
                        </div>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: `hsl(${previewTheme.tokens.border})`, backgroundColor: `hsl(${previewTheme.tokens.card})` }}>
                        <p className="text-sm font-semibold" style={{ color: `hsl(${previewTheme.tokens.primary})` }}>Panel con tono derivado</p>
                        <p className="mt-1 text-sm" style={{ color: `hsl(${previewTheme.tokens["muted-foreground"]})` }}>
                          El sistema usa tokens derivados para hover, seleccion, topbar, badges y acciones primarias.
                        </p>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-3xl border">
                      <div className="flex min-h-[160px]">
                        <div className="w-28 p-4 text-white" style={{ backgroundColor: `hsl(${previewTheme.tokens["sidebar-background"]})` }}>
                          <div className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold">Top bar</div>
                          <div className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold" style={{ backgroundColor: `hsl(${previewTheme.tokens["sidebar-primary"]})`, color: `hsl(${previewTheme.tokens["sidebar-primary-foreground"]})` }}>
                            Item activo
                          </div>
                        </div>
                        <div className="flex-1 p-4" style={{ backgroundColor: `hsl(${previewTheme.tokens.background})` }}>
                          <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: `hsl(${previewTheme.tokens.card})`, borderColor: `hsl(${previewTheme.tokens.border})` }}>
                            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: `hsl(${previewTheme.tokens["muted-foreground"]})` }}>Preview de interfaz</p>
                            <p className="mt-2 text-lg font-bold" style={{ color: `hsl(${previewTheme.tokens.primary})` }}>{form.app_name || "Tu empresa"}</p>
                            <p className="mt-1 text-sm" style={{ color: `hsl(${previewTheme.tokens["muted-foreground"]})` }}>
                              Asi se perciben la barra superior, las cards y las superficies principales dentro de la app.
                            </p>
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
