// Specter Design System - Typography
// Based on SF Pro Display and Text style scales

export const typography = {
  // Display - Big headlines
  displayLarge: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: "800" as const,
    letterSpacing: -1,
  },
  displayMedium: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  
  // Headings
  headlineLarge: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.2,
  },
  headlineMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },
  
  // Body
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: 0.1,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    letterSpacing: 0.2,
  },
  
  // Labels
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600" as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  labelSmall: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  
  // Numbers (for stats)
  statLarge: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  statMedium: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },

  // Backward compatibility for legacy components
  fontSize: {
    "2xs": 10,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 28,
    "4xl": 32,
  },
  fontWeight: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
} as const;

export default typography;
