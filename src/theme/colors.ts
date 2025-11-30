// Specter Design System - Colors
// Extracted from app.tryspecter.com

export const colors = {
  // Sidebar/Navigation
  sidebar: {
    bg: "#0f172a",
    bgDark: "#0a0f1a",
    bgLight: "#1e293b",
    border: "#1e293b",
    text: "#94a3b8",
    textActive: "#ffffff",
    accent: "#22c55e",
  },

  // Primary brand colors
  brand: {
    green: "#22c55e",
    greenLight: "#4ade80",
    greenDark: "#16a34a",
    blue: "#3b82f6",
    blueLight: "#60a5fa",
    blueDark: "#2563eb",
    purple: "#8b5cf6",
    purpleLight: "#a78bfa",
  },

  // Content area
  content: {
    bg: "#ffffff",
    bgSecondary: "#f8fafc",
    bgTertiary: "#f1f5f9",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
  },

  // Text
  text: {
    primary: "#0f172a",
    secondary: "#64748b",
    tertiary: "#94a3b8",
    inverse: "#ffffff",
    muted: "#cbd5e1",
    link: "#3b82f6",
  },

  // Semantic
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",

  // Grayscale
  gray: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },

  // Tags/Badges
  tag: {
    blue: { bg: "#dbeafe", text: "#1e40af" },
    green: { bg: "#dcfce7", text: "#166534" },
    purple: { bg: "#f3e8ff", text: "#6b21a8" },
    orange: { bg: "#ffedd5", text: "#c2410c" },
    yellow: { bg: "#fef3c7", text: "#a16207" },
    red: { bg: "#fee2e2", text: "#b91c1c" },
    gray: { bg: "#f1f5f9", text: "#475569" },
    cyan: { bg: "#cffafe", text: "#0e7490" },
  },

  // Highlight badges
  highlight: {
    fortune: "#3b82f6",
    vc: "#a855f7",
    founder: "#22c55e",
    exit: "#f97316",
    ipo: "#eab308",
    unicorn: "#8b5cf6",
    yc: "#ff6600",
    series: "#06b6d4",
  },

  // Card styles
  card: {
    bg: "#ffffff",
    bgHover: "#f8fafc",
    border: "#e2e8f0",
    shadow: "rgba(0, 0, 0, 0.08)",
  },

  // Status colors
  status: {
    viewed: "#94a3b8",
    liked: "#22c55e",
    disliked: "#ef4444",
    new: "#3b82f6",
  },
} as const;

// Helper to get tag colors by type
export function getTagColor(type: string): { bg: string; text: string } {
  const typeMap: Record<string, keyof typeof colors.tag> = {
    industry: "blue",
    stage: "purple",
    location: "gray",
    funding: "green",
    growth: "cyan",
    highlight: "orange",
    default: "gray",
  };
  const key = typeMap[type.toLowerCase()] || "gray";
  return colors.tag[key];
}

// Helper to get highlight color
export function getHighlightColor(highlight: string): string {
  const lower = highlight.toLowerCase();
  if (lower.includes("fortune") || lower.includes("500")) return colors.highlight.fortune;
  if (lower.includes("unicorn")) return colors.highlight.unicorn;
  if (lower.includes("vc") || lower.includes("backed")) return colors.highlight.vc;
  if (lower.includes("serial") || lower.includes("founder")) return colors.highlight.founder;
  if (lower.includes("exit")) return colors.highlight.exit;
  if (lower.includes("ipo")) return colors.highlight.ipo;
  if (lower.includes("yc") || lower.includes("combinator")) return colors.highlight.yc;
  if (lower.includes("series")) return colors.highlight.series;
  return colors.brand.blue;
}

export default colors;

