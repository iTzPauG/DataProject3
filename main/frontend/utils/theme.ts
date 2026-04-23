import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { useAppState } from "../hooks/useAppState";
import {
  themeColors,
  typography as staticTypography,
  radii as staticRadii,
  shadows as staticShadows,
  colors as staticColors,
  textScale as staticTextScale,
  eyebrow as staticEyebrow,
  space as staticSpace,
} from "../constants/theme";

/**
 * useTheme hook for dynamic theme colors.
 * Responds to user preferences (light/dark/system).
 */
export function useTheme() {
  const { mapPreferences } = useAppState();
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    if (mapPreferences.theme === 'system') {
      return systemColorScheme || 'dark';
    }
    return mapPreferences.theme;
  }, [mapPreferences.theme, systemColorScheme]);

  const colorsValue = useMemo(() => {
    return themeColors[theme as 'dark' | 'light'] || themeColors.dark;
  }, [theme]);

  return {
    colors: colorsValue,
    radii: staticRadii,
    typography: staticTypography,
    shadows: staticShadows,
    text: staticTextScale,
    eyebrow: staticEyebrow,
    space: staticSpace,
    theme,
  };
}

// Static exports for backward compatibility and non-hook contexts
export const colors = staticColors;
export const typography = staticTypography;
export const radii = staticRadii;
export const shadows = staticShadows;
export const textScale = staticTextScale;
export const eyebrow = staticEyebrow;
export const space = staticSpace;
export { themeColors };
