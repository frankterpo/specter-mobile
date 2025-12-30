// Specter Design System - Border Radius
// Comprehensive radius scale for consistent component styling

export const borderRadius = {
  none: 0,
  sm: 4,    // 4px - Small elements
  md: 6,    // 6px - Buttons, inputs (default)
  lg: 8,    // 8px - Cards, modals
  xl: 12,   // 12px - Large cards
  "2xl": 16, // 16px - Badges, chips
  "3xl": 20, // 20px - Avatar containers
  full: 9999, // Full circle (avatars, pills)
} as const;

// Usage:
//
// Buttons: `6px` (md)
// Cards: `8px` (lg)
// Badges/Tags: `16px` (2xl)
// Avatars: `9999px` (full)
// Inputs: `6px` (md)

// Component-specific border radius mappings
export const componentBorderRadius = {
  // Buttons
  button: {
    default: borderRadius.md,      // 6px
    large: borderRadius.lg,        // 8px
    small: borderRadius.sm,        // 4px
  },

  // Cards
  card: {
    default: borderRadius.lg,      // 8px
    large: borderRadius.xl,        // 12px
    small: borderRadius.md,        // 6px
  },

  // Inputs & Form Elements
  input: {
    default: borderRadius.md,      // 6px
    large: borderRadius.lg,        // 8px
  },

  // Badges & Tags
  badge: {
    default: borderRadius["2xl"],  // 16px
    small: borderRadius.xl,        // 12px
  },

  // Avatars
  avatar: {
    default: borderRadius.full,    // 9999px (circle)
    square: borderRadius.md,       // 6px
  },

  // Modals & Dialogs
  modal: {
    default: borderRadius.lg,      // 8px
    large: borderRadius.xl,        // 12px
  },

  // Navigation
  tab: {
    default: borderRadius.md,      // 6px
    active: borderRadius.lg,       // 8px
  },

  // Dropdowns & Popovers
  dropdown: {
    default: borderRadius.lg,      // 8px
    item: borderRadius.md,         // 6px
  },

  // Status indicators
  status: {
    default: borderRadius.full,    // 9999px (circle)
    pill: borderRadius["2xl"],     // 16px
  },

  // Special cases
  special: {
    blob: borderRadius["3xl"],     // 20px (organic shapes)
    custom: borderRadius.xl,       // 12px (custom elements)
  },
} as const;

// Helper function to get border radius by component type
export function getBorderRadius(
  component: keyof typeof componentBorderRadius,
  variant: string = "default"
): number {
  const componentType = componentBorderRadius[component];
  if (!componentType) return borderRadius.md; // fallback

  return (componentType as any)[variant] || componentType.default || borderRadius.md;
}

export default borderRadius;