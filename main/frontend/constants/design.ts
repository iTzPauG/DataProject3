import { Platform } from 'react-native';

/**
 * GADO design tokens.
 *
 * Palette is derived from OKLCH and flattened to hex for React Native
 * compatibility (RN does not parse oklch()).  Neutrals are tinted toward the
 * brand hue (cool indigo) so surfaces feel kin to the accent, not stamped
 * over gray.  Keep additions within the ladder below — never introduce
 * one-off hexes in component files.
 */

// ── Dark palette ──────────────────────────────────────────────────────────
// A dusk charcoal tinted ~270° (cool indigo).  Text is a warm-ivory so it
// never glows against the background the way pure-white does.
const darkColors = {
  // Canvas
  bg: "#0C0D12",           // oklch(0.13 0.01 270)
  shell: "#13141B",        // oklch(0.17 0.012 270)
  surface: "#181A23",      // oklch(0.20 0.012 270)
  surfaceElevated: "#1F2230",

  // Rules / separators (hairlines, not heavy borders)
  border: "#252838",
  borderStrong: "#333853",

  // Brand & accents
  primary: "#6C63E8",      // refined indigo (was #7567F8 — chroma pulled down)
  primaryLight: "#8A82F5",
  primaryMuted: "#2A2747",
  accent: "#E2C38A",       // warm amber — used for hover/hero highlight only
  danger: "#E86D7A",
  warning: "#D9A86B",
  success: "#7BC299",

  // Typography ladder
  text: "#EDEBE3",         // warm-ivory primary
  textSecondary: "#A9A8B6",
  textMuted: "#6D6E82",
  textFaint: "#4A4B5C",

  // UI surfaces (neutral fills that weren't fitting elsewhere)
  chip: "#1C1F2B",
  chipActive: "#2A2D42",
  overlay: "rgba(8, 9, 14, 0.78)",
};

// ── Light palette ─────────────────────────────────────────────────────────
const lightColors = {
  bg: "#F8F6F1",           // warm paper (not grey)
  shell: "#F2EFE7",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#E2DED2",
  borderStrong: "#C8C3B4",
  primary: "#5B53C9",      // slightly darker for light-mode contrast
  primaryLight: "#6C63E8",
  primaryMuted: "#E9E7F6",
  accent: "#B98A3C",
  danger: "#C24B54",
  warning: "#B07E3D",
  success: "#4F9D6E",
  text: "#18191F",
  textSecondary: "#4F5062",
  textMuted: "#7D7F90",
  textFaint: "#A7A9B8",
  chip: "#ECE8DD",
  chipActive: "#DFDACC",
  overlay: "rgba(25, 22, 17, 0.38)",
};

// ── Category accents ─────────────────────────────────────────────────────
// These are indexed by category id (food, nightlife, …) and used for the
// monogram ring stroke.  They are pulled toward the same chroma value so a
// whole screen of categories reads as one family, not a rainbow.
export const categoryAccents: Record<string, string> = {
  food: "#C97A5C",         // terracotta
  restaurant: "#C97A5C",
  nightlife: "#8A7ED6",    // muted violet
  shopping: "#B79958",     // olive gold
  health: "#7FB098",       // sage
  nature: "#88A878",       // moss
  culture: "#C28A5E",      // rust
  sport: "#6E9DB8",        // pool blue
  cinema: "#9C7BB0",       // lilac
  event: "#D2A257",        // warm amber
  market: "#C98E6A",       // clay
  music: "#8088BC",        // dusk indigo
  services: "#808494",     // slate
  pets: "#B38F6D",         // leather
  automotive: "#7A7F8E",
  education: "#A09170",
  wellness: "#B5A2C8",
  coworking: "#7A8FA6",
  default: "#6C63E8",
};

/**
 * Cross-platform font stacks.
 *
 * On web, fonts are loaded at runtime via a <link> injection (see
 * WebFontLoader in app/_layout.tsx).  On native we fall back to Avenir Next
 * (iOS) / Roboto (Android) — both read as editorial-sans and keep the app
 * feeling native without bundling TTFs.
 */
const fontStacks = {
  display: Platform.select({
    ios: '"Bricolage Grotesque", "AvenirNext-DemiBold", System',
    android: '"Bricolage Grotesque", sans-serif-medium',
    default: '"Bricolage Grotesque", "AvenirNext-DemiBold", -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  }),
  body: Platform.select({
    ios: '"Onest", "AvenirNext-Regular", System',
    android: '"Onest", sans-serif',
    default: '"Onest", -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, sans-serif',
  }),
  mono: Platform.select({
    ios: '"JetBrains Mono", "SF Mono", Menlo',
    android: '"JetBrains Mono", monospace',
    default: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  }),
};

export const DS = {
  // 4pt scale with semantic names.  Use `gap` over margin where possible.
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
    hero: 72,
  },

  // Modular radii — 14/20 reads more editorial than the common 12/16 pair.
  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
    pill: 999,
  },

  // 1.25× modular type scale.
  text: {
    xs: { fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
    sm: { fontSize: 13, lineHeight: 19, letterSpacing: 0.1 },
    md: { fontSize: 15, lineHeight: 23, letterSpacing: 0 },
    lg: { fontSize: 18, lineHeight: 26, letterSpacing: -0.1 },
    xl: { fontSize: 22, lineHeight: 30, letterSpacing: -0.2 },
    xxl: { fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
    display: { fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  },

  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  // Eyebrow / label treatment — small caps, generous tracking.
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    fontWeight: "600" as const,
  },

  color: {
    dark: darkColors,
    light: lightColors,
  },

  // Shadows are barely-there — the editorial look avoids heavy elevation.
  shadow: {
    soft: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
    }),
    lift: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 6 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
      },
    }),
    // alias kept for back-compat with existing consumers
    card: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
    }),
    modal: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
      },
      android: { elevation: 10 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
    }),
  },

  font: {
    heading: fontStacks.display,
    body: fontStacks.body,
    mono: fontStacks.mono,
  },
} as const;

/**
 * Monogram helper — used by iconography to derive a single letter from a
 * category id or label, so we never fall back to colored emoji.
 */
export function monogramFor(input: string): string {
  const cleaned = String(input ?? "").trim();
  if (!cleaned) return "·";
  // Prefer first letter of first word; handles multi-word labels.
  const ch = cleaned.match(/[\p{L}\p{N}]/u)?.[0] ?? cleaned[0];
  return ch.toUpperCase();
}
