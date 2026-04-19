export const colors = {
  background: {
    primary: "#0D0B2A",
    card: "rgba(255,255,255,0.06)",
    cardHover: "rgba(255,255,255,0.10)",
    nightMode: "#07060F",
    overlay: "rgba(13,11,42,0.85)",
  },
  text: {
    primary: "#E0D6F0",
    secondary: "#A89BC0",
    muted: "#6B5A8A",
    inverse: "#0D0B2A",
    accent: "#E8A0E0",
  },
  accent: {
    purple: "#C084FC",
    pink: "#F9A8D4",
    aqua: "#67E8F9",
    yellow: "#FDE68A",
    rose: "#E8A0E0",
  },
  border: {
    default: "rgba(255,255,255,0.08)",
    subtle: "rgba(255,255,255,0.04)",
    focus: "#C084FC",
  },
  tag: {
    grateful: "#86EFAC",
    exhausted: "#FCA5A5",
    anxious: "#FDE68A",
    joyful: "#67E8F9",
    sad: "#93C5FD",
    numb: "#A89BC0",
    connected: "#C084FC",
    lonely: "#F9A8D4",
    overwhelmed: "#FCA5A5",
    proud: "#FDE68A",
    angry: "#FC8181",
    hopeful: "#86EFAC",
  },
  night: {
    background: "#07060F",
    card: "rgba(255,200,200,0.05)",
    text: "#FDDEDE",
    accent: "#FCA5A5",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
} as const;

export const motion = {
  fast: 150,
  normal: 300,
  slow: 500,
  verySlow: 800,
} as const;
