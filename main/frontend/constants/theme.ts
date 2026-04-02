import { DS } from "./design";

export const themeColors = {
  dark: {
    ink: DS.color.dark.text,
    inkMuted: DS.color.dark.textSecondary,
    brand: DS.color.dark.primary,
    brandDeep: DS.color.dark.primaryLight,
    accent: DS.color.dark.accent,
    surface: DS.color.dark.surface,
    shell: DS.color.dark.shell,
    stroke: DS.color.dark.border,
    chip: DS.color.dark.chip,
    chipText: DS.color.dark.text,
    overlay: DS.color.dark.overlay,
    warning: DS.color.dark.warning,
    success: DS.color.dark.success,
    danger: DS.color.dark.danger,
    bg: DS.color.dark.bg,
  },
  light: {
    ink: DS.color.light.text,
    inkMuted: DS.color.light.textSecondary,
    brand: DS.color.light.primary,
    brandDeep: DS.color.light.primaryLight,
    accent: DS.color.light.accent,
    surface: DS.color.light.surface,
    shell: DS.color.light.shell,
    stroke: DS.color.light.border,
    chip: DS.color.light.chip,
    chipText: DS.color.light.text,
    overlay: DS.color.light.overlay,
    warning: DS.color.light.warning,
    success: DS.color.light.success,
    danger: DS.color.light.danger,
    bg: DS.color.light.bg,
  }
};

export const typography = {
  display: DS.font.heading,
  heading: DS.font.heading,
  body: DS.font.body,
};

export const radii = DS.radius;

export const shadows = {
  soft: DS.shadow.card,
  lift: DS.shadow.modal,
};

// For backward compatibility (reflects dark theme)
export const colors = themeColors.dark;
