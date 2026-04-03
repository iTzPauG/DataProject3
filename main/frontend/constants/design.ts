import { Platform } from 'react-native';

const darkColors = {
  bg: "#090B13",
  shell: "#111420",
  surface: "#171B29",
  surfaceElevated: "#20263A",
  border: "#2B324A",
  primary: "#7567F8",
  primaryLight: "#958BFF",
  accent: "#00D1AE",
  danger: "#FF5E73",
  warning: "#FFB86B",
  success: "#64D98B",
  text: "#F5F7FF",
  textSecondary: "#A7AECA",
  textMuted: "#6D7596",
  chip: "#232B41",
  chipActive: "#2D3560",
  overlay: "rgba(7, 9, 16, 0.72)",
};

const lightColors = {
  bg: "#F8F9FC",
  shell: "#F0F2F7",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#E2E8F0",
  primary: "#7567F8", // Keep brand color
  primaryLight: "#958BFF",
  accent: "#00D1AE",
  danger: "#E53E3E",
  warning: "#D69E2E",
  success: "#38A169",
  text: "#1A202C",
  textSecondary: "#4A5568",
  textMuted: "#718096",
  chip: "#EDF2F7",
  chipActive: "#E2E8F0",
  overlay: "rgba(0, 0, 0, 0.4)",
};

export const DS = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 },
  text: {
    xs: { fontSize: 11, lineHeight: 16 },
    sm: { fontSize: 13, lineHeight: 18 },
    md: { fontSize: 15, lineHeight: 22 },
    lg: { fontSize: 17, lineHeight: 24 },
    xl: { fontSize: 20, lineHeight: 28 },
    xxl: { fontSize: 26, lineHeight: 34 },
    hero: { fontSize: 32, lineHeight: 40 },
  },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  color: {
    dark: darkColors,
    light: lightColors,
  },
  shadow: {
    card: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: { elevation: 5 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
    }),
    modal: Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
      default: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
      },
    }),
  },
  font: {
    heading: Platform.select({
      ios: "AvenirNext-Bold",
      android: "sans-serif-medium",
      default: "System",
    }),
    body: Platform.select({
      ios: "AvenirNext-Regular",
      android: "sans-serif",
      default: "System",
    }),
  },
} as const;
