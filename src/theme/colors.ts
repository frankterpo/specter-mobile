// Specter Design System - Colors
// Based on cursor.com and tryspecter.com main theme colors

export const colors = {
  // Primary Brand - Blue (CTAs, active states, links)
  primary: "#3b82f6",           // Specter blue - main brand color (from tryspecter.com)
  primaryLight: "#60a5fa",     // Lighter variant for hover states
  primaryDark: "#2563eb",      // Darker variant for pressed states (cursor.com style)
  primaryForeground: "#ffffff", // White text on blue

  // Sidebar/Navigation - Dark Navy
  sidebar: {
    bg: "#0f172a",           // Main sidebar background
    bgLight: "#1e293b",      // Lighter sidebar sections
    bgDark: "#0a0f1a",       // Darkest sidebar variant
    border: "#1e293b",     // Sidebar border color
    foreground: "#94a3b8", // Sidebar text (muted)
    foregroundActive: "#ffffff", // Active sidebar item text
    accent: "#1e293b",     // Active sidebar item background
  },

  // Content Backgrounds
  background: "#ffffff",        // Main app background
  backgroundSecondary: "#f8fafc", // Secondary background (cards, sections)
  backgroundTertiary: "#f1f5f9", // Tertiary background

  // Text Hierarchy
  foreground: "#0f172a",        // Primary text (dark navy)
  foregroundSecondary: "#64748b", // Secondary text (slate-500)
  foregroundMuted: "#94a3b8",   // Muted text (slate-400)
  foregroundInverse: "#ffffff", // White text on dark backgrounds

  // Borders & Dividers
  border: "#e2e8f0",            // Main border color (slate-200)
  borderLight: "#f1f5f9",      // Light border (slate-100)
  input: "#e2e8f0",             // Input border (matches border)

  // Cards
  card: {
    bg: "#ffffff",              // Card background
    foreground: "#0f172a",     // Card text
    border: "#e2e8f0",        // Card border
  },

  // Semantic Colors
  destructive: "#ef4444",       // Error/destructive actions (red-500)
  destructiveForeground: "#ffffff",
  success: "#3b82f6",           // Replaced emerald with primary blue
  warning: "#f59e0b",           // Warning (amber-500)
  info: "#3b82f6",              // Info (blue-500 - matches primary)

  // Muted/Secondary
  muted: {
    bg: "#f1f5f9",             // Muted background (slate-100)
    foreground: "#64748b",   // Muted text (slate-500)
  },

  // Popover/Dropdown
  popover: {
    bg: "#ffffff",
    foreground: "#0f172a",
  },

  // White (for overlays, etc.)
  white: "#ffffff",

  // Grayscale Scale (for reference)
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
    green: { bg: "#dbeafe", text: "#1e40af" }, // Replaced with blue variant
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
    founder: "#3b82f6",  // Replaced emerald with primary blue
    exit: "#f97316",
    ipo: "#eab308",
    unicorn: "#8b5cf6",
    yc: "#ff6600",
    series: "#06b6d4",
  },

  // Status colors
  status: {
    viewed: "#94a3b8",
    liked: "#3b82f6",  // Replaced emerald with primary blue
    disliked: "#ef4444",
    new: "#3b82f6",
  },

  // Semantic groupings for easier access
  text: {
    primary: "#0f172a", // matches foreground
    secondary: "#64748b", // matches foregroundSecondary
    tertiary: "#94a3b8", // matches foregroundMuted
    inverse: "#ffffff", // matches foregroundInverse
    muted: "#94a3b8",
    link: "#3b82f6", // matches primary
  },

  content: {
    bg: "#ffffff", // matches background
    bgSecondary: "#f8fafc", // matches backgroundSecondary
    bgTertiary: "#f1f5f9", // matches backgroundTertiary
    border: "#e2e8f0", // matches border
    borderLight: "#f1f5f9", // matches borderLight
  },

  // Backward compatibility aliases for components using colors.brand.*
  brand: {
    blue: "#3b82f6", // matches primary
    blueLight: "#60a5fa", // matches primaryLight
    blueDark: "#2563eb", // matches primaryDark
    green: "#3b82f6", // Replaced with primary blue per "no green" rule
    greenLight: "#60a5fa",
    greenDark: "#2563eb",
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
  return colors.primary; // Use new primary color instead of brand.blue
}

// Backward compatibility aliases
export const brand = {
  blue: colors.primary,
  blueLight: colors.primaryLight,
  blueDark: colors.primaryDark,
};

export const text = {
  primary: colors.foreground,
  secondary: colors.foregroundSecondary,
  tertiary: colors.foregroundMuted,
  inverse: colors.foregroundInverse,
  muted: colors.gray[400], // Approximate match
  link: colors.primary,
};

export const content = {
  bg: colors.background,
  bgSecondary: colors.backgroundSecondary,
  bgTertiary: colors.backgroundTertiary,
  border: colors.border,
  borderLight: colors.borderLight,
};

export default colors;

