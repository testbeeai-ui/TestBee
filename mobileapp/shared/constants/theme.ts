export const colors = {
  background: "#090E1A",
  surface: "#121B30",
  surfaceRaised: "#161B25",
  surfaceSoft: "#1C2333",
  border: "rgba(42, 51, 71, 0.82)",
  borderStrong: "#334060",
  text: "#E8EAF0",
  textStrong: "#F8FAFC",
  textMuted: "#9BA3B8",
  textDim: "#5C6480",
  accent: "#1D9E75",
  accentLight: "#9FE1CB",
  accentMuted: "#0A2A20",
  purple: "#534AB7",
  purpleLight: "#AFA9EC",
  coral: "#D85A30",
  amber: "#EF9F27",
  danger: "#E24B4A",
  tabInactive: "#6b7280",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  caption: 12,
  body: 14,
  bodyLarge: 16,
  title: 20,
  hero: 28,
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  raised: {
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
} as const;
