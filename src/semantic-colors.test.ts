import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

function readHslToken(name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`));
  if (!match) throw new Error(`Missing HSL token --${name}`);
  return match.slice(1).map(Number) as [number, number, number];
}

function hslToRgb([hue, saturationPercent, lightnessPercent]: [number, number, number]) {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const intermediate = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;
  const channels =
    hue < 60 ? [chroma, intermediate, 0]
      : hue < 120 ? [intermediate, chroma, 0]
        : hue < 180 ? [0, chroma, intermediate]
          : hue < 240 ? [0, intermediate, chroma]
            : hue < 300 ? [intermediate, 0, chroma]
              : [chroma, 0, intermediate];
  return channels.map((channel) => channel + offset);
}

function relativeLuminance(rgb: number[]) {
  const [red, green, blue] = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastAgainstWhite(token: string) {
  const luminance = relativeLuminance(hslToRgb(readHslToken(token)));
  return 1.05 / (luminance + 0.05);
}

describe("semantic color accessibility", () => {
  it.each(["success", "warning", "destructive", "info"])(
    "keeps --%s readable as text on light surfaces",
    (token) => {
      expect(contrastAgainstWhite(token)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
