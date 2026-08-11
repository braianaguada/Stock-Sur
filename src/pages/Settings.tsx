import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/common/VisualSystem";
import { canManageBillingSettings, canViewSettings } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useSettingsManagement } from "@/features/settings/hooks/useSettingsManagement";
import { BillingFiscalSettingsSection } from "@/features/billing/components/BillingFiscalSettingsSection";
import { useBillingActions } from "@/features/billing/hooks/useBillingActions";
import { useBillingDiagnostics, useBillingPointsOfSale, useBillingSettings } from "@/features/billing/hooks/useBillingData";
import { billingFeatureEnabled } from "@/lib/features";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("company-settings");
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
  const settingsAccessContext = { companyRoleCodes, companyPermissionCodes };
  const canAccessSettings = canManage || canViewSettings(roles, settingsAccessContext) || canManageBillingSettings(roles, settingsAccessContext);
  const canEditBillingSettings = canManageBillingSettings(roles, settingsAccessContext);
  const billingSettingsQuery = useBillingSettings(currentCompany?.id ?? null);
  const billingPointsQuery = useBillingPointsOfSale(currentCompany?.id ?? null);
  const billingDiagnosticsQuery = useBillingDiagnostics(canEditBillingSettings ? currentCompany?.id ?? null : null);
  const {
    saveBillingSettingsMutation,
    createBillingPointOfSaleMutation,
    updateBillingPointOfSaleMutation,
  } = useBillingActions({ companyId: currentCompany?.id ?? null });

  if (!canAccessSettings) {
    return (
      <AppLayout>
        <PageContainer className="page-shell">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
            <p className="text-muted-foreground">Acceso restringido a usuarios administradores.</p>
          </div>

          <Card className="max-w-2xl border-warning/25 bg-warning/10 shadow-none">
            <CardHeader>
              <CardTitle>Sin permisos</CardTitle>
              <CardDescription>
                La configuracion global y fiscal requiere permisos de configuracion.
              </CardDescription>
            </CardHeader>
          </Card>
        </PageContainer>
      </AppLayout>
    );
  }

  if (!currentCompany) {
    return (
      <AppLayout>
        <PageContainer className="page-shell">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
            <p className="text-muted-foreground">Todavia no hay una empresa activa seleccionada.</p>
          </div>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        <PageHeader
          eyebrow="Administración de empresa"
          title="Configuración"
          subtitle={`Administrá los datos operativos y la identidad visual de ${form.app_name || currentCompany.name}.`}
          meta={(
            <>
              <span className="text-sm font-medium text-muted-foreground">{currentCompany.name}</span>
              <StatusBadge tone={canManage ? "success" : "muted"}>{canManage ? "Edición habilitada" : "Solo lectura"}</StatusBadge>
            </>
          )}
          actions={canManage ? (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
              {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
            </Button>
          ) : null}
          tabs={[
            { label: "Empresa y operación", value: "company-settings" },
            { label: "Marca visual", value: "brand-settings" },
          ]}
          activeTab={activeSection}
          onTabChange={setActiveSection}
          variant="workspace"
        />

        {activeSection === "company-settings" ? (
          <Card
            aria-labelledby="company-settings-title"
            className="min-w-0 border-border/70 shadow-none"
          >
            <CardHeader>
              <CardTitle id="company-settings-title">Empresa y operación</CardTitle>
              <CardDescription>
                Datos compartidos por la aplicación, reglas operativas y valores predeterminados de documentos y servicios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 border-b border-border/60 pb-3 md:col-span-2">
                  <h2 className="font-semibold text-foreground">Identidad fiscal</h2>
                  <p className="text-sm text-muted-foreground">
                    Información principal de la empresa utilizada en la interfaz y los comprobantes.
                  </p>
                </div>
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
                <div className="mt-4 space-y-1 border-b border-border/60 pb-3 md:col-span-2">
                  <h2 className="font-semibold text-foreground">Reglas operativas</h2>
                  <p className="text-sm text-muted-foreground">
                    Comportamientos que afectan la emisión, el cierre de caja y los precios sugeridos.
                  </p>
                </div>
                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4 md:col-span-2">
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
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 md:col-span-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="auto_close_cash_enabled"
                      checked={form.auto_close_cash_enabled}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          auto_close_cash_enabled: checked === true,
                        }))
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="auto_close_cash_enabled" className="cursor-pointer">
                        Cerrar caja automáticamente
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Si sigue abierta al llegar la hora configurada, el sistema la cerrará sola.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:max-w-xs">
                    <Label>Hora máxima de cierre</Label>
                    <Input
                      type="time"
                      value={form.auto_close_cash_time}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          auto_close_cash_time: e.target.value,
                        }))
                      }
                      disabled={!form.auto_close_cash_enabled}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-4 md:col-span-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="price_rounding_enabled"
                      checked={form.price_rounding_enabled}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          price_rounding_enabled: checked === true,
                          price_rounding_increment: checked === true ? prev.price_rounding_increment || "500" : "",
                        }))
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="price_rounding_enabled" className="cursor-pointer">
                        Redondeo de precios
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        El redondeo se aplica al precio sugerido al cargar productos en documentos. No modifica costos ni listas originales.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:max-w-xs">
                    <Label>Incremento</Label>
                    <Select
                      value={form.price_rounding_enabled ? form.price_rounding_increment || "500" : "none"}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          price_rounding_enabled: value !== "none",
                          price_rounding_increment: value === "none" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin redondeo</SelectItem>
                        <SelectItem value="100">Redondear a $100</SelectItem>
                        <SelectItem value="500">Redondear a $500</SelectItem>
                        <SelectItem value="1000">Redondear a $1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 space-y-1 border-b border-border/60 pb-3 md:col-span-2">
                  <h2 className="font-semibold text-foreground">Contacto y documentos</h2>
                  <p className="text-sm text-muted-foreground">
                    Datos de contacto y textos que se reutilizan en los documentos emitidos.
                  </p>
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
                <div className="mt-4 space-y-1 border-b border-border/60 pb-3 md:col-span-2">
                  <h2 className="font-semibold text-foreground">Valores predeterminados de servicios</h2>
                  <p className="text-sm text-muted-foreground">
                    Textos y condiciones iniciales para nuevas propuestas de servicios.
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Default de servicios: introduccion</Label>
                  <Textarea value={form.service_default_intro_text} onChange={(e) => setForm((prev) => ({ ...prev, service_default_intro_text: e.target.value }))} rows={3} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Default de servicios: cierre</Label>
                  <Textarea value={form.service_default_closing_text} onChange={(e) => setForm((prev) => ({ ...prev, service_default_closing_text: e.target.value }))} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Plazo de entrega por defecto</Label>
                  <Input value={form.service_default_delivery_time} onChange={(e) => setForm((prev) => ({ ...prev, service_default_delivery_time: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Condiciones de pago por defecto</Label>
                  <Input value={form.service_default_payment_terms} onChange={(e) => setForm((prev) => ({ ...prev, service_default_payment_terms: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Lugar de entrega por defecto</Label>
                  <Input value={form.service_default_delivery_location} onChange={(e) => setForm((prev) => ({ ...prev, service_default_delivery_location: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Vigencia por defecto (dias)</Label>
                  <Input type="number" min={1} value={form.service_default_valid_days} onChange={(e) => setForm((prev) => ({ ...prev, service_default_valid_days: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            aria-labelledby="brand-settings-title"
            className="min-w-0 border-border/70 shadow-none"
          >
            <CardHeader>
              <CardTitle id="brand-settings-title">Marca visual</CardTitle>
              <CardDescription>
                Definí el logo, el modo de apariencia y dos colores de marca. El sistema deriva el resto de los tonos para mantener contraste y consistencia.
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
                  <Label>Apariencia</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      { id: "professional" as const, name: "Modo claro", description: "Superficies claras y contraste cómodo para uso diario." },
                      { id: "premium-dark" as const, name: "Modo oscuro", description: "Superficies oscuras con la misma jerarquía y accesibilidad." },
                    ]).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        aria-pressed={themePreset === mode.id}
                        onClick={() => setThemePreset(mode.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                          themePreset === mode.id
                            ? "border-primary bg-primary/5 shadow-[var(--shadow-xs)]"
                            : "border-border/80 bg-background/70 hover:bg-accent/60"
                        }`}
                      >
                        <p className="font-semibold">{mode.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{mode.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Color principal</Label>
                    <div className="grid grid-cols-[1fr_56px] gap-2">
                      <Input value={form.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))} placeholder="#1f4f99" />
                      <Input aria-label="Elegir color principal" type="color" value={form.primary_color} onChange={(e) => setForm((prev) => ({ ...prev, primary_color: e.target.value }))} className="h-10 p-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Acciones primarias, foco y elementos seleccionados.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Color secundario</Label>
                    <div className="grid grid-cols-[1fr_56px] gap-2">
                      <Input value={form.secondary_color} onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))} placeholder="#315a8a" />
                      <Input aria-label="Elegir color secundario" type="color" value={form.secondary_color} onChange={(e) => setForm((prev) => ({ ...prev, secondary_color: e.target.value }))} className="h-10 p-1" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Apoyos visuales y contraste complementario. Los estados conservan su color semántico.
                    </p>
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
                    <div className="rounded-3xl border">
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
              </CardContent>
            </Card>
        )}

        {billingFeatureEnabled ? <section id="billing-fiscal-settings">
          <BillingFiscalSettingsSection
            settings={billingSettingsQuery.settings}
            pointsOfSale={billingPointsQuery.data ?? []}
            isLoading={billingSettingsQuery.isLoading || billingPointsQuery.isLoading}
            onSaveSettings={(input, callbacks) => saveBillingSettingsMutation.mutate(input, callbacks)}
            onCreatePointOfSale={(input, callbacks) => createBillingPointOfSaleMutation.mutate(input, callbacks)}
            onUpdatePointOfSale={(input, callbacks) => updateBillingPointOfSaleMutation.mutate(input, callbacks)}
            savingSettings={saveBillingSettingsMutation.isPending}
            creatingPointOfSale={createBillingPointOfSaleMutation.isPending}
            updatingPointOfSale={updateBillingPointOfSaleMutation.isPending}
            toast={toast}
            canEdit={canEditBillingSettings}
            diagnostics={billingDiagnosticsQuery.data ?? null}
            diagnosticsLoading={billingDiagnosticsQuery.isLoading}
          />
        </section> : null}
      </PageContainer>
    </AppLayout>
  );
}


