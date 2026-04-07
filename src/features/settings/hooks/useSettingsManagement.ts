import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { canManageCompanySettings } from "@/lib/permissions";
import {
  buildCompanyThemePayload,
  getThemePreviewState,
  inferThemePreset,
  type CompanyThemePresetId,
} from "@/lib/companyTheme";

type UseSettingsManagementOptions = {
  companyId: string | null | undefined;
  roles: string[];
  companyRoleCodes: string[];
  companyPermissionCodes: string[];
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
};

export function useSettingsManagement({
  companyId,
  roles,
  companyRoleCodes,
  companyPermissionCodes,
  toast,
}: UseSettingsManagementOptions) {
  const { settings, isLoading } = useCompanyBrand();
  const qc = useQueryClient();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [themePreset, setThemePreset] = useState<CompanyThemePresetId>("professional");
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
    allow_issue_remitos_without_stock: false,
  });

  useEffect(() => {
    const preset = inferThemePreset(settings);
    const derivedTheme = buildCompanyThemePayload(preset, settings.primary_color ?? "#1f4f99");
    setThemePreset(preset);
    setForm({
      app_name: settings.app_name ?? "",
      legal_name: settings.legal_name ?? "",
      tax_id: settings.tax_id ?? "",
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      whatsapp: settings.whatsapp ?? "",
      email: settings.email ?? "",
      primary_color: derivedTheme.primary_color,
      secondary_color: derivedTheme.secondary_color,
      accent_color: derivedTheme.accent_color,
      document_tagline: settings.document_tagline ?? "",
      document_footer: settings.document_footer ?? "",
      default_point_of_sale: String(settings.default_point_of_sale ?? 1),
      allow_issue_remitos_without_stock: settings.allow_issue_remitos_without_stock ?? false,
    });
    setLogoPreview(settings.logo_url ?? "");
  }, [settings]);

  const previewTheme = useMemo(
    () => getThemePreviewState(themePreset, form.primary_color),
    [form.primary_color, themePreset],
  );

  const canManage = canManageCompanySettings(roles, { companyRoleCodes, companyPermissionCodes });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logoUrl = settings.logo_url;
      const themePayload = buildCompanyThemePayload(themePreset, form.primary_color);

      if (logoFile) {
        const extension = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
        const filePath = `${companyId!}/company-logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("branding-assets")
          .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type || undefined });
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("branding-assets").getPublicUrl(filePath);
        logoUrl = data.publicUrl;
      }

      const payload = {
        company_id: companyId!,
        app_name: form.app_name.trim() || "Stock Sur",
        legal_name: form.legal_name.trim() || null,
        tax_id: form.tax_id.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        logo_url: logoUrl ?? null,
        primary_color: themePayload.primary_color,
        secondary_color: themePayload.secondary_color,
        accent_color: themePayload.accent_color,
        document_tagline: form.document_tagline.trim() || null,
        document_footer: form.document_footer.trim() || null,
        default_point_of_sale: Math.max(1, Number(form.default_point_of_sale) || 1),
        allow_issue_remitos_without_stock: form.allow_issue_remitos_without_stock,
      };

      const { error } = await supabase
        .from("company_settings")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      setLogoFile(null);
      await qc.invalidateQueries({ queryKey: ["company-settings", companyId ?? "default"] });
      toast({ title: "Configuracion guardada" });
    },
    onError: (error: unknown) => {
      toast({
        title: "No se pudo guardar",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
  };

  return {
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
  };
}
