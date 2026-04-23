import { DS } from "./design";

/**
 * Theme colour maps consumed through the `useTheme` hook.
 *
 * Keys in this map are the public contract; individual screens should read
 * named roles (e.g. `colors.ink`, `colors.border`) rather than raw palette
 * values.  New tokens added here are opt-in for consumers, so existing
 * screens keep rendering until they are migrated.
 */
export const themeColors = {
  dark: {
    // text ladder
    ink: DS.color.dark.text,
    inkMuted: DS.color.dark.textSecondary,
    inkFaint: DS.color.dark.textMuted,
    inkWhisper: DS.color.dark.textFaint,

    // surfaces
    bg: DS.color.dark.bg,
    shell: DS.color.dark.shell,
    surface: DS.color.dark.surface,
    surfaceElevated: DS.color.dark.surfaceElevated,

    // rules
    stroke: DS.color.dark.border,
    strokeStrong: DS.color.dark.borderStrong,

    // brand
    brand: DS.color.dark.primary,
    brandDeep: DS.color.dark.primaryLight,
    brandMuted: DS.color.dark.primaryMuted,
    accent: DS.color.dark.accent,

    // chip (sparingly — prefer hairline rules)
    chip: DS.color.dark.chip,
    chipActive: DS.color.dark.chipActive,
    chipText: DS.color.dark.text,

    // state
    warning: DS.color.dark.warning,
    success: DS.color.dark.success,
    danger: DS.color.dark.danger,

    overlay: DS.color.dark.overlay,
  },
  light: {
    ink: DS.color.light.text,
    inkMuted: DS.color.light.textSecondary,
    inkFaint: DS.color.light.textMuted,
    inkWhisper: DS.color.light.textFaint,
    bg: DS.color.light.bg,
    shell: DS.color.light.shell,
    surface: DS.color.light.surface,
    surfaceElevated: DS.color.light.surfaceElevated,
    stroke: DS.color.light.border,
    strokeStrong: DS.color.light.borderStrong,
    brand: DS.color.light.primary,
    brandDeep: DS.color.light.primaryLight,
    brandMuted: DS.color.light.primaryMuted,
    accent: DS.color.light.accent,
    chip: DS.color.light.chip,
    chipActive: DS.color.light.chipActive,
    chipText: DS.color.light.text,
    warning: DS.color.light.warning,
    success: DS.color.light.success,
    danger: DS.color.light.danger,
    overlay: DS.color.light.overlay,
  },
};

export const typography = {
  display: DS.font.heading,
  heading: DS.font.heading,
  body: DS.font.body,
  mono: DS.font.mono,
};

export const radii = DS.radius;

export const shadows = {
  soft: DS.shadow.soft,
  lift: DS.shadow.lift,
  card: DS.shadow.card,     // legacy alias
  modal: DS.shadow.modal,
};

export const textScale = DS.text;
export const eyebrow = DS.eyebrow;
export const space = DS.space;

// Legacy default (dark theme) — kept for modules that still import `colors`
// directly instead of using the hook.
export const colors = themeColors.dark;
