import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CompanyBrandContext, DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/contexts/company-brand-context";
import { useAuth } from "@/contexts/AuthContext";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100 };
  }

  const diff = max - min;
  const saturation = lightness > 0.5 ? diff / (2 - max - min) : diff / (max + min);
  let hue = 0;

  switch (max) {
    case rNorm:
      hue = (gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0);
      break;
    case gNorm:
      hue = (bNorm - rNorm) / diff + 2;
      break;
    default:
      hue = (rNorm - gNorm) / diff + 4;
      break;
  }

  return {
    h: Math.round(hue * 60),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

const toHslChannels = (hex: string, fallback: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  const hsl = rgbToHsl(rgb);
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
};

const shiftLightness = (hex: string, delta: number, fallback: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  const hsl = rgbToHsl(rgb);
  return `${hsl.h} ${hsl.s}% ${clamp(hsl.l + delta, 6, 94)}%`;
};

const applyCompanyTheme = (settings: CompanySettings) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--primary", toHslChannels(settings.primary_color, "220 60% 20%"));
  root.style.setProperty("--ring", toHslChannels(settings.primary_color, "220 60% 20%"));
  root.style.setProperty("--secondary", toHslChannels(settings.secondary_color, "0 72% 51%"));
  root.style.setProperty("--accent", toHslChannels(settings.accent_color, "210 20% 94%"));
  root.style.setProperty("--sidebar-background", shiftLightness(settings.primary_color, -32, "220 25% 12%"));
  root.style.setProperty("--sidebar-accent", shiftLightness(settings.primary_color, -22, "220 20% 18%"));
  root.style.setProperty("--sidebar-border", shiftLightness(settings.primary_color, -18, "220 20% 20%"));
  root.style.setProperty("--sidebar-primary", toHslChannels(settings.secondary_color, "38 92% 50%"));
  root.style.setProperty("--sidebar-ring", toHslChannels(settings.secondary_color, "38 92% 50%"));
};

export function CompanyBrandProvider({ children }: { children: ReactNode }) {
  const { currentCompany, session } = useAuth();
  const query = useQuery({
    queryKey: ["company-settings", currentCompany?.id ?? "default"],
    enabled: Boolean(session?.user && currentCompany?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { ...DEFAULT_COMPANY_SETTINGS, company_id: currentCompany!.id }) as CompanySettings;
    },
  });

  const settings = useMemo(() => (
    query.data ?? {
      ...DEFAULT_COMPANY_SETTINGS,
      app_name: currentCompany?.name ?? DEFAULT_COMPANY_SETTINGS.app_name,
      legal_name: currentCompany?.name ?? DEFAULT_COMPANY_SETTINGS.legal_name,
      company_id: currentCompany?.id ?? null,
    }
  ), [currentCompany?.id, currentCompany?.name, query.data]);

  useEffect(() => {
    applyCompanyTheme(settings);
  }, [settings]);

  const value = useMemo(() => ({
    settings,
    isLoading: query.isLoading,
  }), [settings, query.isLoading]);

  return <CompanyBrandContext.Provider value={value}>{children}</CompanyBrandContext.Provider>;
}
