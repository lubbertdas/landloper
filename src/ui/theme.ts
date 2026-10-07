/**
 * The single home of Landloper's look and feel.
 *
 * Every colour, font size, spacing step and corner radius used by the UI
 * comes from here. Screens and components refer to these names
 * (`theme.colors.accent`) and never to raw values, so restyling the whole
 * app is an edit to this file.
 */

export const theme = {
  colors: {
    background: "#0B1020",
    surface: "#161C33",
    surfaceRaised: "#1F2745",
    text: "#F2F4FA",
    textMuted: "#9AA3C0",
    accent: "#F5B942",
    accentText: "#0B1020",
    track: "#2A3358",
    reached: "#F5B942",
    unreached: "#4A5480",
    danger: "#FF6B6B",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 12,
    lg: 20,
    round: 999,
  },
  // Sizes lean large: the live screen is read while walking.
  font: {
    caption: 13,
    body: 16,
    title: 20,
    heading: 28,
    display: 44,
  },
  weight: {
    regular: "400",
    bold: "700",
  },
} as const;

export type Theme = typeof theme;
