import type { CompanySettings } from "@/contexts/company-brand-context";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export type CompanyThemePresetId = "professional" | "industrial" | "premium-dark" | "minimal";

export type ThemeOption = {
  id: CompanyThemePresetId;
  name: string;
  description: string;
  appearance: "light" | "dark";
  defaultPrimary: string;
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "professional",
    name: "Profesional azul",
    description: "Azul ejecutivo, contraste limpio y sensación financiera premium.",
    appearance: "light",
    defaultPrimary: "#2353a6",
  },
  {
    id: "industrial",
    name: "Industrial teal",
    description: "Más táctico y técnico, con superficies minerales y acento teal.",
    appearance: "light",
    defaultPrimary: "#0f766e",
  },
  {
    id: "premium-dark",
    name: "Oscuro premium",
    description: "Carbón profundo, acentos precisos y mejor foco en datos densos.",
    appearance: "dark",
    defaultPrimary: "#4f7cff",
  },
  {
    id: "minimal",
    name: "Minimal claro",
    description: "Neutro cálido, más editorial y con menos ruido visual.",
    appearance: "light",
    defaultPrimary: "#586277",
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeHex = (value: string | null | undefined, fallback = "#1f4f99") => {
  const normalized = (value ?? "").trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return `#${normalized.toLowerCase()}`;
};

const hexToRgb = (hex: string): Rgb | null => {
  const normalized = normalizeHex(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/.test(normalized)) return null;
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const componentToHex = (component: number) => component.toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${componentToHex(clamp(Math.round(r), 0, 255))}${componentToHex(clamp(Math.round(g), 0, 255))}${componentToHex(clamp(Math.round(b), 0, 255))}`;

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
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

const hueToRgb = (p: number, q: number, t: number) => {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const sNorm = clamp(s, 0, 100) / 100;
  const lNorm = clamp(l, 0, 100) / 100;

  if (sNorm === 0) {
    const gray = lNorm * 255;
    return { r: gray, g: gray, b: gray };
  }

  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;
  return {
    r: hueToRgb(p, q, hNorm + 1 / 3) * 255,
    g: hueToRgb(p, q, hNorm) * 255,
    b: hueToRgb(p, q, hNorm - 1 / 3) * 255,
  };
};

const shiftHsl = (hex: string, adjustments: Partial<Hsl>) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return normalizeHex(hex);
  const current = rgbToHsl(rgb);
  return rgbToHex(
    hslToRgb({
      h: current.h + (adjustments.h ?? 0),
      s: clamp(current.s + (adjustments.s ?? 0), 0, 100),
      l: clamp(current.l + (adjustments.l ?? 0), 0, 100),
    }),
  );
};

const toHslChannels = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return "220 60% 20%";
  const hsl = rgbToHsl(rgb);
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
};

const hslDistance = (aHex: string, bHex: string) => {
  const a = rgbToHsl(hexToRgb(aHex) ?? { r: 0, g: 0, b: 0 });
  const b = rgbToHsl(hexToRgb(bHex) ?? { r: 0, g: 0, b: 0 });
  return Math.abs(a.h - b.h) * 0.7 + Math.abs(a.s - b.s) * 0.15 + Math.abs(a.l - b.l) * 0.15;
};

type DerivedTheme = {
  preset: ThemeOption;
  primaryColor: string;
  legacy: {
    secondaryColor: string;
    accentColor: string;
  };
  tokens: Record<string, string>;
};

const deriveTheme = (presetId: CompanyThemePresetId, primaryInput: string): DerivedTheme => {
  const preset = THEME_OPTIONS.find((theme) => theme.id === presetId) ?? THEME_OPTIONS[0];
  const primaryColor = normalizeHex(primaryInput, preset.defaultPrimary);
  const primaryHover = shiftHsl(primaryColor, { l: preset.appearance === "dark" ? 6 : -7, s: 4 });
  const primarySoft = shiftHsl(primaryColor, { l: preset.appearance === "dark" ? 20 : 34, s: -12 });
  const infoColor = shiftHsl(primaryColor, { h: 8, s: -8, l: preset.appearance === "dark" ? 8 : 6 });
  const successColor = preset.id === "industrial" ? shiftHsl(primaryColor, { h: 12, s: 10, l: 4 }) : "#1f9d66";
  const warningColor = preset.appearance === "dark" ? "#f4b942" : "#c98512";
  const dangerColor = preset.appearance === "dark" ? "#ef6b73" : "#d9485f";

  if (preset.id === "premium-dark") {
    const secondaryColor = shiftHsl(primaryColor, { h: 26, s: 12, l: 10 });
    const accentColor = shiftHsl(primaryColor, { l: -22, s: -28 });

    return {
      preset,
      primaryColor,
      legacy: {
        secondaryColor,
        accentColor,
      },
      tokens: {
        background: "224 28% 7%",
        foreground: "214 28% 95%",
        card: "224 22% 11%",
        "card-foreground": "214 28% 95%",
        popover: "223 24% 11%",
        "popover-foreground": "214 28% 95%",
        muted: "224 16% 17%",
        "muted-foreground": "217 13% 74%",
        accent: "224 18% 15%",
        "accent-foreground": "214 28% 95%",
        border: "224 14% 23%",
        input: "224 14% 21%",
        panel: "224 20% 14%",
        hover: "224 15% 18%",
        "focus-ring": toHslChannels(primaryColor),
        primary: toHslChannels(primaryColor),
        "primary-foreground": "0 0% 100%",
        "primary-soft": toHslChannels(primarySoft),
        secondary: toHslChannels(secondaryColor),
        "secondary-foreground": "224 39% 11%",
        destructive: toHslChannels(dangerColor),
        "destructive-foreground": "0 0% 100%",
        success: toHslChannels(successColor),
        "success-foreground": "0 0% 100%",
        warning: toHslChannels(warningColor),
        "warning-foreground": "33 100% 8%",
        info: toHslChannels(infoColor),
        "info-foreground": "0 0% 100%",
        ring: toHslChannels(primaryColor),
        "sidebar-background": "222 35% 7%",
        "sidebar-foreground": "214 18% 78%",
        "sidebar-primary": toHslChannels(primaryColor),
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "222 21% 14%",
        "sidebar-accent-foreground": "210 16% 94%",
        "sidebar-border": "222 18% 16%",
        "sidebar-ring": toHslChannels(primaryColor),
        "shadow-color": `${toHslChannels(primaryColor)} / 0.28`,
      },
    };
  }

  if (preset.id === "industrial") {
    const secondaryColor = shiftHsl(primaryColor, { h: 12, s: 2, l: 8 });
    const accentColor = shiftHsl(primaryColor, { l: 40, s: -20 });

    return {
      preset,
      primaryColor,
      legacy: {
        secondaryColor,
        accentColor,
      },
      tokens: {
        background: "165 23% 97%",
        foreground: "196 26% 16%",
        card: "0 0% 100%",
        "card-foreground": "196 26% 16%",
        popover: "0 0% 100%",
        "popover-foreground": "196 26% 16%",
        muted: "166 19% 92%",
        "muted-foreground": "196 12% 42%",
        accent: "168 26% 92%",
        "accent-foreground": "196 26% 16%",
        border: "167 15% 84%",
        input: "167 14% 82%",
        panel: "167 31% 94%",
        hover: "168 22% 89%",
        "focus-ring": toHslChannels(primaryColor),
        primary: toHslChannels(primaryColor),
        "primary-foreground": "0 0% 100%",
        "primary-soft": toHslChannels(primarySoft),
        secondary: toHslChannels(secondaryColor),
        "secondary-foreground": "0 0% 100%",
        destructive: toHslChannels(dangerColor),
        "destructive-foreground": "0 0% 100%",
        success: toHslChannels(successColor),
        "success-foreground": "0 0% 100%",
        warning: toHslChannels(warningColor),
        "warning-foreground": "34 100% 10%",
        info: toHslChannels(infoColor),
        "info-foreground": "0 0% 100%",
        ring: toHslChannels(primaryColor),
        "sidebar-background": "185 37% 11%",
        "sidebar-foreground": "182 19% 83%",
        "sidebar-primary": toHslChannels(primaryColor),
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "184 28% 18%",
        "sidebar-accent-foreground": "180 17% 93%",
        "sidebar-border": "185 22% 20%",
        "sidebar-ring": toHslChannels(primaryColor),
        "shadow-color": `${toHslChannels(primaryColor)} / 0.12`,
      },
    };
  }

  if (preset.id === "minimal") {
    const secondaryColor = shiftHsl(primaryColor, { s: -14, l: -4 });
    const accentColor = shiftHsl(primaryColor, { s: -26, l: 38 });

    return {
      preset,
      primaryColor,
      legacy: {
        secondaryColor,
        accentColor,
      },
      tokens: {
        background: "36 31% 98%",
        foreground: "223 16% 16%",
        card: "0 0% 100%",
        "card-foreground": "223 16% 16%",
        popover: "0 0% 100%",
        "popover-foreground": "223 16% 16%",
        muted: "34 20% 94%",
        "muted-foreground": "218 9% 42%",
        accent: "33 22% 95%",
        "accent-foreground": "223 16% 16%",
        border: "30 17% 86%",
        input: "30 15% 84%",
        panel: "34 26% 95%",
        hover: "30 19% 92%",
        "focus-ring": toHslChannels(primaryColor),
        primary: toHslChannels(primaryColor),
        "primary-foreground": "0 0% 100%",
        "primary-soft": toHslChannels(primarySoft),
        secondary: toHslChannels(secondaryColor),
        "secondary-foreground": "0 0% 100%",
        destructive: toHslChannels(dangerColor),
        "destructive-foreground": "0 0% 100%",
        success: toHslChannels(successColor),
        "success-foreground": "0 0% 100%",
        warning: toHslChannels(warningColor),
        "warning-foreground": "34 100% 10%",
        info: toHslChannels(infoColor),
        "info-foreground": "0 0% 100%",
        ring: toHslChannels(primaryColor),
        "sidebar-background": "219 27% 14%",
        "sidebar-foreground": "213 18% 82%",
        "sidebar-primary": toHslChannels(primaryColor),
        "sidebar-primary-foreground": "0 0% 100%",
        "sidebar-accent": "219 18% 20%",
        "sidebar-accent-foreground": "214 19% 94%",
        "sidebar-border": "219 16% 21%",
        "sidebar-ring": toHslChannels(primaryColor),
        "shadow-color": `${toHslChannels(primaryColor)} / 0.1`,
      },
    };
  }

  const secondaryColor = shiftHsl(primaryColor, { h: 24, s: 6, l: -10 });
  const accentColor = shiftHsl(primaryColor, { l: 42, s: -18 });

  return {
    preset,
    primaryColor,
    legacy: {
      secondaryColor,
      accentColor,
    },
    tokens: {
      background: "214 31% 97%",
      foreground: "222 34% 14%",
      card: "0 0% 100%",
      "card-foreground": "222 34% 14%",
      popover: "0 0% 100%",
      "popover-foreground": "222 34% 14%",
      muted: "214 23% 93%",
      "muted-foreground": "215 14% 43%",
      accent: "214 35% 94%",
      "accent-foreground": "222 34% 14%",
      border: "214 20% 86%",
      input: "214 18% 84%",
      panel: "214 44% 95%",
      hover: "214 30% 91%",
      "focus-ring": toHslChannels(primaryColor),
      primary: toHslChannels(primaryColor),
      "primary-foreground": "0 0% 100%",
      "primary-soft": toHslChannels(primarySoft),
      secondary: toHslChannels(secondaryColor),
      "secondary-foreground": "0 0% 100%",
      destructive: toHslChannels(dangerColor),
      "destructive-foreground": "0 0% 100%",
      success: toHslChannels(successColor),
      "success-foreground": "0 0% 100%",
      warning: toHslChannels(warningColor),
      "warning-foreground": "34 100% 10%",
      info: toHslChannels(infoColor),
      "info-foreground": "0 0% 100%",
      ring: toHslChannels(primaryColor),
      "sidebar-background": "220 33% 13%",
      "sidebar-foreground": "212 18% 82%",
      "sidebar-primary": toHslChannels(primaryHover),
      "sidebar-primary-foreground": "0 0% 100%",
      "sidebar-accent": "220 23% 18%",
      "sidebar-accent-foreground": "213 21% 95%",
      "sidebar-border": "220 18% 20%",
      "sidebar-ring": toHslChannels(primaryColor),
      "shadow-color": `${toHslChannels(primaryColor)} / 0.12`,
    },
  };
};

export const inferThemePreset = (settings: Pick<CompanySettings, "primary_color" | "secondary_color" | "accent_color">) => {
  const primary = normalizeHex(settings.primary_color);
  const actualSecondary = normalizeHex(settings.secondary_color, deriveTheme("professional", primary).legacy.secondaryColor);
  const actualAccent = normalizeHex(settings.accent_color, deriveTheme("professional", primary).legacy.accentColor);

  const [bestMatch] = THEME_OPTIONS
    .map((theme) => {
      const derived = deriveTheme(theme.id, primary);
      return {
        id: theme.id,
        score:
          hslDistance(derived.legacy.secondaryColor, actualSecondary) +
          hslDistance(derived.legacy.accentColor, actualAccent),
      };
    })
    .sort((a, b) => a.score - b.score);

  return bestMatch?.id ?? "professional";
};

const getCompanyThemeState = (settings: Pick<CompanySettings, "primary_color" | "secondary_color" | "accent_color">) => {
  const presetId = inferThemePreset(settings);
  return deriveTheme(presetId, settings.primary_color);
};

export const getThemePreviewState = (presetId: CompanyThemePresetId, primaryColor: string) => deriveTheme(presetId, primaryColor);

export const buildCompanyThemePayload = (presetId: CompanyThemePresetId, primaryColor: string) => {
  const derived = deriveTheme(presetId, primaryColor);
  return {
    primary_color: derived.primaryColor,
    secondary_color: derived.legacy.secondaryColor,
    accent_color: derived.legacy.accentColor,
  };
};

export const applyCompanyTheme = (settings: Pick<CompanySettings, "primary_color" | "secondary_color" | "accent_color">) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = getCompanyThemeState(settings);
  root.classList.toggle("dark", theme.preset.appearance === "dark");
  root.dataset.uiTheme = theme.preset.id;

  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(`--${name}`, value);
  }
};
