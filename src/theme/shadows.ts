// Specter Design System - Shadows
// Comprehensive shadow system for React Native and web consistency

export const shadows = {
  // Subtle shadows (cards, inputs)
  sm: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.75,
    elevation: 2, // Android
  },

  // Default shadow (cards, buttons)
  md: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.75,
    elevation: 3,
  },

  // Large shadow (modals, dropdowns)
  lg: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5.25,
    elevation: 8,
  },

  // Extra large (modals)
  xl: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 13.125,
    elevation: 12,
  },
} as const;

// CSS Shadow Equivalents (for web)
// sm: `0 1px 2px rgba(0, 0, 0, 0.05)`
// md: `0 1px 3px rgba(0, 0, 0, 0.08)`
// lg: `0 4px 6px rgba(0, 0, 0, 0.1)`
// xl: `0 10px 15px rgba(0, 0, 0, 0.1)`

// Component-specific shadow mappings
export const componentShadows = {
  // Cards
  card: {
    default: shadows.md,
    hover: shadows.lg,
    pressed: shadows.sm,
  },

  // Buttons
  button: {
    default: shadows.md,
    pressed: shadows.sm,
    disabled: {}, // No shadow for disabled buttons
  },

  // Inputs
  input: {
    default: shadows.sm,
    focus: shadows.md,
    error: shadows.sm, // Keep subtle for errors
  },

  // Modals & Overlays
  modal: {
    default: shadows.lg,
    large: shadows.xl,
  },

  // Dropdowns & Popovers
  dropdown: {
    default: shadows.lg,
    item: shadows.sm,
  },

  // Navigation
  navigation: {
    tabBar: shadows.sm,
    header: shadows.md,
  },

  // Special cases
  floating: {
    default: shadows.lg,
    elevated: shadows.xl,
  },
} as const;

// Helper function to get shadow by component type
export function getShadow(
  component: keyof typeof componentShadows,
  variant: string = "default"
): typeof shadows.sm {
  const componentType = componentShadows[component];
  if (!componentType) return shadows.md; // fallback

  return (componentType as any)[variant] || componentType.default || shadows.md;
}

// Utility functions for dynamic shadows
export function createShadow(
  color: string = "#000000",
  offset: { width: number; height: number } = { width: 0, height: 1 },
  opacity: number = 0.08,
  radius: number = 1.75,
  elevation: number = 3
) {
  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation,
  };
}

export default shadows;